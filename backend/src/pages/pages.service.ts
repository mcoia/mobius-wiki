import { Injectable, Inject, NotFoundException, ConflictException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { Pool } from 'pg';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import { PageVersionsService } from './page-versions.service';
import { generateSlug } from '../common/utils/slug.util';
import { AccessControlService } from '../access-control/access-control.service';
import { wrapData } from '../common/utils/response.util';

interface User {
  id: number;
  role?: string;
  libraryId?: number | null;
}

@Injectable()
export class PagesService {
  constructor(
    @Inject('DATABASE_POOL') private pool: Pool,
    private pageVersionsService: PageVersionsService,
    private aclService: AccessControlService,
  ) {}

  /**
   * Get the version of a page that should be shown to the current user
   * - Editors see current draft (unless forcePublished=true)
   * - Non-editors see last published version (if page is draft but was published before)
   * - Non-editors see current if page is published
   * - Non-editors get 404 if page has never been published and is draft
   */
  private async getVisibleVersion(page: any, user: User | null, forcePublished = false) {
    const canEdit = await this.aclService.canEdit(user, 'page', page.id);

    // Get current version number
    const { rows: versionRows } = await this.pool.query(
      'SELECT MAX(version_number) as current_version FROM wiki.page_versions WHERE page_id = $1',
      [page.id]
    );
    const currentVersion = versionRows[0]?.current_version || 0;

    // If editor explicitly wants published version, skip to published logic
    if (!forcePublished && canEdit) {
      // Editors see current draft with metadata
      return {
        ...page,
        currentVersionNumber: currentVersion,
        isViewingDraft: page.status === 'draft',
        hasDraft: page.status === 'draft' && page.published_version_number !== null
      };
    }

    // Published pages - show current
    if (page.status === 'published') {
      return {
        ...page,
        currentVersionNumber: currentVersion,
        isViewingDraft: false,
        hasDraft: false
      };
    }

    // Draft but previously published - show last published version
    if (page.status === 'draft' && page.published_version_number) {
      const { rows } = await this.pool.query(
        `SELECT pv.content, pv.title, pv.scripts
         FROM wiki.page_versions pv
         WHERE pv.page_id = $1 AND pv.version_number = $2`,
        [page.id, page.published_version_number]
      );

      if (rows.length > 0) {
        const publishedVersion = rows[0];
        // Return page with published version content
        return {
          ...page,
          content: publishedVersion.content,
          title: publishedVersion.title,
          scripts: publishedVersion.scripts || null,
          currentVersionNumber: currentVersion,
          isViewingDraft: false,
          hasDraft: true
        };
      }
    }

    // If editor forced published view but no published version exists
    if (forcePublished && canEdit && !page.published_version_number) {
      throw new BadRequestException('No published version exists');
    }

    // Truly unpublished draft - hide from non-editors
    throw new NotFoundException(`Page with ID ${page.id} not found`);
  }

  async findAllInSection(sectionId: number, user: User | null = null, includeDeleted = false) {
    // Verify section exists
    const { rows: sectionRows } = await this.pool.query(
      'SELECT id FROM wiki.sections WHERE id = $1 AND deleted_at IS NULL',
      [sectionId]
    );

    if (sectionRows.length === 0) {
      throw new NotFoundException(`Section with ID ${sectionId} not found`);
    }

    const whereClause = includeDeleted
      ? 'WHERE section_id = $1'
      : 'WHERE section_id = $1 AND deleted_at IS NULL';

    const { rows } = await this.pool.query(
      `SELECT * FROM wiki.pages ${whereClause} ORDER BY sort_order, title`,
      [sectionId]
    );

    // Filter by ACL and status
    const accessible = [];
    for (const page of rows) {
      // Check ACL access
      const hasReadAccess = await this.aclService.canAccess(user, 'page', page.id);
      if (!hasReadAccess) {
        continue;  // User can't read this page at all
      }

      // Check status visibility
      if (page.status === 'draft') {
        const canEdit = await this.aclService.canEdit(user, 'page', page.id);
        if (!canEdit) {
          continue;  // User can't see this draft - skip it
        }
      }

      accessible.push(page);
    }

    return {
      data: accessible,
      meta: { total: accessible.length },
    };
  }

  async findOne(id: number, user: User | null = null, includeDeleted = false, viewPublished = false) {
    const whereClause = includeDeleted
      ? 'WHERE id = $1'
      : 'WHERE id = $1 AND deleted_at IS NULL';

    const { rows } = await this.pool.query(
      `SELECT * FROM wiki.pages ${whereClause}`,
      [id]
    );

    if (rows.length === 0) {
      throw new NotFoundException(`Page with ID ${id} not found`);
    }

    // Get visible version based on user permissions and page status
    const visibleVersion = await this.getVisibleVersion(rows[0], user, viewPublished);

    return wrapData(visibleVersion);
  }

  async findBySlug(
    wikiSlug: string,
    sectionSlug: string,
    pageSlug: string,
    user: any,
    includeDeleted = false,
    viewPublished = false
  ) {
    const deletedClause = includeDeleted ? '' : 'AND p.deleted_at IS NULL';

    const query = `
      SELECT
        p.id,
        p.section_id,
        p.title,
        p.slug,
        p.content,
        p.scripts,
        p.allow_scripts,
        p.status,
        p.sort_order,
        p.published_at,
        p.created_at,
        p.updated_at,
        p.created_by,
        p.updated_by,
        p.deleted_at,
        p.deleted_by,
        json_build_object('title', w.title, 'slug', w.slug) as wiki,
        json_build_object('title', s.title, 'slug', s.slug) as section,
        json_build_object('id', u.id, 'name', u.name, 'email', u.email) as author
      FROM wiki.pages p
      JOIN wiki.sections s ON p.section_id = s.id
      JOIN wiki.wikis w ON s.wiki_id = w.id
      LEFT JOIN wiki.users u ON p.created_by = u.id
      WHERE w.slug = $1
        AND s.slug = $2
        AND p.slug = $3
        ${deletedClause}
    `;

    const { rows } = await this.pool.query(query, [wikiSlug, sectionSlug, pageSlug]);

    if (rows.length === 0) {
      throw new NotFoundException(
        `Page '${pageSlug}' not found in wiki '${wikiSlug}', section '${sectionSlug}'`
      );
    }

    const page = rows[0];

    // Check ACL after fetching the page
    const hasAccess = await this.aclService.canAccess(user, 'page', page.id);

    if (!hasAccess) {
      throw new ForbiddenException('Access denied');
    }

    // Get visible version (replaces checkPageVisibility)
    const visibleVersion = await this.getVisibleVersion(page, user, viewPublished);

    return wrapData(visibleVersion);
  }

  async create(sectionId: number, dto: CreatePageDto, userId: number) {
    // Verify section exists
    const { rows: sectionRows } = await this.pool.query(
      'SELECT id FROM wiki.sections WHERE id = $1 AND deleted_at IS NULL',
      [sectionId]
    );

    if (sectionRows.length === 0) {
      throw new NotFoundException(`Section with ID ${sectionId} not found`);
    }

    const slug = dto.slug || generateSlug(dto.title);
    const status = dto.status || 'draft';

    // Check if slug exists in this section
    const { rows: existing } = await this.pool.query(
      'SELECT id FROM wiki.pages WHERE section_id = $1 AND slug = $2 AND deleted_at IS NULL',
      [sectionId, slug]
    );

    if (existing.length > 0) {
      throw new ConflictException(`A page with slug '${slug}' already exists in this section`);
    }

    // Get max sort_order for this section to ensure chronological ordering
    const { rows: maxOrderRows } = await this.pool.query(
      'SELECT COALESCE(MAX(sort_order), -1) as max_order FROM wiki.pages WHERE section_id = $1 AND deleted_at IS NULL',
      [sectionId]
    );
    const sortOrder = dto.sortOrder ?? (maxOrderRows[0].max_order + 1);

    // Create page
    const publishedAt = status === 'published' ? 'NOW()' : 'NULL';

    const { rows } = await this.pool.query(
      `INSERT INTO wiki.pages (section_id, title, slug, content, scripts, allow_scripts, status, sort_order, published_at, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, ${publishedAt}, $9, $9)
       RETURNING *`,
      [
        sectionId,
        dto.title,
        slug,
        dto.content,
        dto.scripts || null,
        dto.allowScripts || false,
        status,
        sortOrder,
        userId
      ]
    );

    const page = rows[0];

    // Create initial version
    await this.pageVersionsService.createVersion(
      page.id,
      page.title,
      page.content,
      page.scripts || null,
      userId
    );

    return wrapData(page);
  }

  /**
   * Generate a unique slug for a page in a section by appending numeric suffix if needed
   */
  private async generateUniqueSlug(sectionId: number, baseSlug: string, currentPageId: number): Promise<string> {
    // Check if base slug conflicts
    const { rows: conflictRows } = await this.pool.query(
      'SELECT id FROM wiki.pages WHERE section_id = $1 AND slug = $2 AND id != $3 AND deleted_at IS NULL',
      [sectionId, baseSlug, currentPageId]
    );

    if (conflictRows.length === 0) {
      return baseSlug;
    }

    // Find unique slug by appending numeric suffix
    let counter = 2;
    while (true) {
      const candidateSlug = `${baseSlug}-${counter}`;
      const { rows: checkRows } = await this.pool.query(
        'SELECT id FROM wiki.pages WHERE section_id = $1 AND slug = $2 AND deleted_at IS NULL',
        [sectionId, candidateSlug]
      );

      if (checkRows.length === 0) {
        return candidateSlug;
      }

      counter++;

      // Safety limit to prevent infinite loop
      if (counter > 1000) {
        throw new BadRequestException('Unable to generate unique slug after 1000 attempts');
      }
    }
  }

  async update(id: number, dto: UpdatePageDto, userId: number, user: User | null = null) {
    // Get current page
    const { data: page } = await this.findOne(id, user);

    const updates: string[] = [];
    const values: any[] = [id];
    let paramCount = 2;

    let newTitle = page.title;
    let newContent = page.content;
    let newScripts = page.scripts || null;
    let newSlug = page.slug;

    // Handle section move
    if (dto.sectionId !== undefined && dto.sectionId !== page.section_id) {
      // Validate target section exists
      const { rows: targetSectionRows } = await this.pool.query(
        'SELECT id, wiki_id FROM wiki.sections WHERE id = $1 AND deleted_at IS NULL',
        [dto.sectionId]
      );

      if (targetSectionRows.length === 0) {
        throw new NotFoundException(`Target section with ID ${dto.sectionId} not found`);
      }

      const targetSection = targetSectionRows[0];

      // Verify target section belongs to same wiki
      const { rows: currentSectionRows } = await this.pool.query(
        'SELECT wiki_id FROM wiki.sections WHERE id = $1',
        [page.section_id]
      );

      if (currentSectionRows[0].wiki_id !== targetSection.wiki_id) {
        throw new BadRequestException('Cannot move page to section in different wiki');
      }

      // Check edit permission on target section
      const canEditTargetSection = await this.aclService.canEdit(user, 'section', dto.sectionId);
      if (!canEditTargetSection) {
        throw new ForbiddenException('You do not have permission to add pages to the target section');
      }

      // Check slug conflicts in target section and auto-resolve
      newSlug = await this.generateUniqueSlug(dto.sectionId, page.slug, id);

      // Update section_id and slug if changed
      updates.push(`section_id = $${paramCount}`);
      values.push(dto.sectionId);
      paramCount++;

      if (newSlug !== page.slug) {
        updates.push(`slug = $${paramCount}`);
        values.push(newSlug);
        paramCount++;
      }

      // Get max sort_order in target section and append
      const { rows: maxOrderRows } = await this.pool.query(
        'SELECT COALESCE(MAX(sort_order), -1) as max_order FROM wiki.pages WHERE section_id = $1 AND deleted_at IS NULL',
        [dto.sectionId]
      );
      const newSortOrder = maxOrderRows[0].max_order + 1;

      updates.push(`sort_order = $${paramCount}`);
      values.push(newSortOrder);
      paramCount++;
    }

    // AUTO-DRAFT: If editing a published page, change to draft
    if (page.status === 'published' && (dto.content !== undefined || dto.title !== undefined)) {
      updates.push(`status = 'draft'`);
    }

    if (dto.title !== undefined) {
      updates.push(`title = $${paramCount}`);
      values.push(dto.title);
      newTitle = dto.title;
      paramCount++;
    }

    if (dto.content !== undefined) {
      updates.push(`content = $${paramCount}`);
      values.push(dto.content);
      newContent = dto.content;
      paramCount++;
    }

    if (dto.scripts !== undefined) {
      updates.push(`scripts = $${paramCount}`);
      values.push(dto.scripts);
      newScripts = dto.scripts;
      paramCount++;
    }

    if (dto.allowScripts !== undefined) {
      updates.push(`allow_scripts = $${paramCount}`);
      values.push(dto.allowScripts);
      paramCount++;
    }

    if (dto.sortOrder !== undefined) {
      updates.push(`sort_order = $${paramCount}`);
      values.push(dto.sortOrder);
      paramCount++;
    }

    updates.push(`updated_by = $${paramCount}`);
    values.push(userId);
    paramCount++;

    updates.push('updated_at = NOW()');

    if (updates.length === 2) {
      // Only updated_by and updated_at, nothing actually changed
      return wrapData(page);
    }

    const { rows } = await this.pool.query(
      `UPDATE wiki.pages
       SET ${updates.join(', ')}
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      values
    );

    if (rows.length === 0) {
      throw new NotFoundException(`Page with ID ${id} not found`);
    }

    const updatedPage = rows[0];

    // Create new version if content, title, or scripts changed
    if (dto.content !== undefined || dto.title !== undefined || dto.scripts !== undefined) {
      await this.pageVersionsService.createVersion(
        updatedPage.id,
        newTitle,
        newContent,
        newScripts,
        userId
      );
    }

    return wrapData(updatedPage);
  }

  async publish(id: number, userId: number) {
    // Get current max version for this page
    const { rows: versionRows } = await this.pool.query(
      'SELECT MAX(version_number) as max_version FROM wiki.page_versions WHERE page_id = $1',
      [id]
    );
    const publishedVersion = versionRows[0]?.max_version || 1;

    const { rows } = await this.pool.query(
      `UPDATE wiki.pages
       SET status = 'published',
           published_at = COALESCE(published_at, NOW()),
           published_version_number = $2,
           updated_by = $3,
           updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      [id, publishedVersion, userId]
    );

    if (rows.length === 0) {
      throw new NotFoundException(`Page with ID ${id} not found`);
    }

    return wrapData(rows[0]);
  }

  async discardDraft(id: number, user: User | null) {
    // Check edit permission
    const canEdit = await this.aclService.canEdit(user, 'page', id);
    if (!canEdit) {
      throw new ForbiddenException('You do not have permission to modify this page');
    }

    // Get page
    const { rows: pageRows } = await this.pool.query(
      'SELECT * FROM wiki.pages WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );

    if (pageRows.length === 0) {
      throw new NotFoundException(`Page with ID ${id} not found`);
    }

    const page = pageRows[0];

    // Only works if page has been published before
    if (!page.published_version_number) {
      throw new BadRequestException('Cannot discard draft - page has never been published');
    }

    // Get published version content
    const { rows: versionRows } = await this.pool.query(
      'SELECT content, title, scripts FROM wiki.page_versions WHERE page_id = $1 AND version_number = $2',
      [id, page.published_version_number]
    );

    if (versionRows.length === 0) {
      throw new NotFoundException('Published version not found');
    }

    const publishedVersion = versionRows[0];

    // Revert to published version
    const { rows } = await this.pool.query(
      `UPDATE wiki.pages
       SET content = $2,
           title = $3,
           scripts = $4,
           status = 'published',
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, publishedVersion.content, publishedVersion.title, publishedVersion.scripts]
    );

    return wrapData(rows[0]);
  }

  async remove(id: number, userId: number) {
    const { rows } = await this.pool.query(
      `UPDATE wiki.pages
       SET deleted_at = NOW(),
           deleted_by = $2,
           updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      [id, userId]
    );

    if (rows.length === 0) {
      throw new NotFoundException(`Page with ID ${id} not found`);
    }

    return wrapData(rows[0]);
  }
}
