import { Injectable, Inject, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Pool } from 'pg';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import { PageVersionsService } from './page-versions.service';
import { generateSlug } from '../common/utils/slug.util';
import { AccessControlService } from '../access-control/access-control.service';

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

    // Filter by ACL
    const accessible = [];
    for (const page of rows) {
      if (await this.aclService.canAccess(user, 'page', page.id)) {
        accessible.push(page);
      }
    }

    return {
      data: accessible,
      meta: { total: accessible.length },
    };
  }

  async findOne(id: number, includeDeleted = false) {
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

    return rows[0];
  }

  async findBySlug(
    wikiSlug: string,
    sectionSlug: string,
    pageSlug: string,
    user: any,
    token: string | undefined,
    includeDeleted = false
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
    const hasAccess = await this.aclService.canAccess(user, 'page', page.id, token);

    if (!hasAccess) {
      throw new ForbiddenException('Access denied');
    }

    return page;
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
        dto.sortOrder || 0,
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

    return page;
  }

  async update(id: number, dto: UpdatePageDto, userId: number) {
    // Get current page
    const page = await this.findOne(id);

    const updates: string[] = [];
    const values: any[] = [id];
    let paramCount = 2;

    let newTitle = page.title;
    let newContent = page.content;
    let newScripts = page.scripts || null;

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
      return page;
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

    return updatedPage;
  }

  async publish(id: number, userId: number) {
    const { rows } = await this.pool.query(
      `UPDATE wiki.pages
       SET status = 'published',
           published_at = NOW(),
           updated_by = $2,
           updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      [id, userId]
    );

    if (rows.length === 0) {
      throw new NotFoundException(`Page with ID ${id} not found`);
    }

    return rows[0];
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

    return rows[0];
  }
}
