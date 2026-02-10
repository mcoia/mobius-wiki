import { Injectable, Inject, NotFoundException, ConflictException } from '@nestjs/common';
import { Pool } from 'pg';
import { CreateSectionDto } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { generateSlug } from '../common/utils/slug.util';
import { AccessControlService } from '../access-control/access-control.service';
import { wrapData } from '../common/utils/response.util';

interface User {
  id: number;
  role?: string;
  libraryId?: number | null;
}

@Injectable()
export class SectionsService {
  constructor(
    @Inject('DATABASE_POOL') private pool: Pool,
    private aclService: AccessControlService,
  ) {}

  async findAllInWiki(wikiId: number, user: User | null = null, includeDeleted = false) {
    // First verify wiki exists
    const { rows: wikiRows } = await this.pool.query(
      'SELECT id FROM wiki.wikis WHERE id = $1 AND deleted_at IS NULL',
      [wikiId]
    );

    if (wikiRows.length === 0) {
      throw new NotFoundException(`Wiki with ID ${wikiId} not found`);
    }

    const whereClause = includeDeleted
      ? 'WHERE wiki_id = $1'
      : 'WHERE wiki_id = $1 AND deleted_at IS NULL';

    const { rows } = await this.pool.query(
      `SELECT * FROM wiki.sections ${whereClause} ORDER BY sort_order, title`,
      [wikiId]
    );

    // Filter by ACL
    const accessible = [];
    for (const section of rows) {
      if (await this.aclService.canAccess(user, 'section', section.id)) {
        accessible.push(section);
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
      `SELECT * FROM wiki.sections ${whereClause}`,
      [id]
    );

    if (rows.length === 0) {
      throw new NotFoundException(`Section with ID ${id} not found`);
    }

    return wrapData(rows[0]);
  }

  async create(wikiId: number, dto: CreateSectionDto, userId: number) {
    // Verify wiki exists
    const { rows: wikiRows } = await this.pool.query(
      'SELECT id FROM wiki.wikis WHERE id = $1 AND deleted_at IS NULL',
      [wikiId]
    );

    if (wikiRows.length === 0) {
      throw new NotFoundException(`Wiki with ID ${wikiId} not found`);
    }

    const slug = dto.slug || generateSlug(dto.title);

    // Check if slug exists in this wiki (must be unique within wiki, regardless of parent)
    const { rows: existing } = await this.pool.query(
      'SELECT id FROM wiki.sections WHERE wiki_id = $1 AND slug = $2 AND deleted_at IS NULL',
      [wikiId, slug]
    );

    if (existing.length > 0) {
      throw new ConflictException(`A section with slug '${slug}' already exists in this wiki`);
    }

    // Calculate depth based on parent section
    let depth = 0;
    let parentSectionId: number | null = null;

    if (dto.parentSectionId) {
      // Verify parent section exists and belongs to the same wiki
      const { rows: parentRows } = await this.pool.query(
        'SELECT id, depth FROM wiki.sections WHERE id = $1 AND wiki_id = $2 AND deleted_at IS NULL',
        [dto.parentSectionId, wikiId]
      );

      if (parentRows.length === 0) {
        throw new NotFoundException(`Parent section with ID ${dto.parentSectionId} not found in this wiki`);
      }

      parentSectionId = dto.parentSectionId;
      depth = parentRows[0].depth + 1;
    }

    // Get max sort_order for this parent level to ensure chronological ordering
    const { rows: maxOrderRows } = await this.pool.query(
      `SELECT COALESCE(MAX(sort_order), -1) as max_order
       FROM wiki.sections
       WHERE wiki_id = $1
         AND COALESCE(parent_section_id, 0) = COALESCE($2, 0)
         AND deleted_at IS NULL`,
      [wikiId, parentSectionId]
    );
    const sortOrder = dto.sortOrder ?? (maxOrderRows[0].max_order + 1);

    const { rows } = await this.pool.query(
      `INSERT INTO wiki.sections (wiki_id, parent_section_id, title, slug, description, sort_order, depth, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
       RETURNING *`,
      [wikiId, parentSectionId, dto.title, slug, dto.description || null, sortOrder, depth, userId]
    );

    return wrapData(rows[0]);
  }

  async update(id: number, dto: UpdateSectionDto, userId: number) {
    // Get current section info
    const { rows: sectionRows } = await this.pool.query(
      'SELECT wiki_id, parent_section_id FROM wiki.sections WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );

    if (sectionRows.length === 0) {
      throw new NotFoundException(`Section with ID ${id} not found`);
    }

    const wikiId = sectionRows[0].wiki_id;

    // If slug is being updated, check for conflicts within the same wiki
    if (dto.slug) {
      const { rows: existing } = await this.pool.query(
        'SELECT id FROM wiki.sections WHERE wiki_id = $1 AND slug = $2 AND id != $3 AND deleted_at IS NULL',
        [wikiId, dto.slug, id]
      );

      if (existing.length > 0) {
        throw new ConflictException(`A section with slug '${dto.slug}' already exists in this wiki`);
      }
    }

    const updates: string[] = [];
    const values: any[] = [id];
    let paramCount = 2;

    if (dto.title !== undefined) {
      updates.push(`title = $${paramCount}`);
      values.push(dto.title);
      paramCount++;
    }

    if (dto.slug !== undefined) {
      updates.push(`slug = $${paramCount}`);
      values.push(dto.slug);
      paramCount++;
    }

    if (dto.description !== undefined) {
      updates.push(`description = $${paramCount}`);
      values.push(dto.description);
      paramCount++;
    }

    if (dto.sortOrder !== undefined) {
      updates.push(`sort_order = $${paramCount}`);
      values.push(dto.sortOrder);
      paramCount++;
    }

    // Handle parent section change
    if (dto.parentSectionId !== undefined) {
      let newDepth = 0;
      const newParentId = dto.parentSectionId;

      if (newParentId !== null) {
        // Prevent circular references
        if (newParentId === id) {
          throw new ConflictException('A section cannot be its own parent');
        }

        // Verify parent section exists and belongs to the same wiki
        const { rows: parentRows } = await this.pool.query(
          'SELECT id, depth FROM wiki.sections WHERE id = $1 AND wiki_id = $2 AND deleted_at IS NULL',
          [newParentId, wikiId]
        );

        if (parentRows.length === 0) {
          throw new NotFoundException(`Parent section with ID ${newParentId} not found in this wiki`);
        }

        newDepth = parentRows[0].depth + 1;

        // Check for circular reference (new parent can't be a descendant of this section)
        const descendants = await this.getDescendantIds(id);
        if (descendants.includes(newParentId)) {
          throw new ConflictException('Cannot set a descendant section as parent (circular reference)');
        }
      }

      updates.push(`parent_section_id = $${paramCount}`);
      values.push(newParentId);
      paramCount++;

      updates.push(`depth = $${paramCount}`);
      values.push(newDepth);
      paramCount++;
    }

    updates.push(`updated_by = $${paramCount}`);
    values.push(userId);
    paramCount++;

    updates.push('updated_at = NOW()');

    if (updates.length === 2) {
      return this.findOne(id);
    }

    const { rows } = await this.pool.query(
      `UPDATE wiki.sections
       SET ${updates.join(', ')}
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      values
    );

    if (rows.length === 0) {
      throw new NotFoundException(`Section with ID ${id} not found`);
    }

    // If parent changed, recursively update depths of all descendants
    if (dto.parentSectionId !== undefined) {
      await this.updateDescendantDepths(id, rows[0].depth);
    }

    return wrapData(rows[0]);
  }

  /**
   * Get all descendant section IDs for circular reference detection
   */
  private async getDescendantIds(sectionId: number): Promise<number[]> {
    const { rows } = await this.pool.query(
      `WITH RECURSIVE descendants AS (
        SELECT id FROM wiki.sections WHERE parent_section_id = $1 AND deleted_at IS NULL
        UNION ALL
        SELECT s.id FROM wiki.sections s
        INNER JOIN descendants d ON s.parent_section_id = d.id
        WHERE s.deleted_at IS NULL
      )
      SELECT id FROM descendants`,
      [sectionId]
    );
    return rows.map(r => r.id);
  }

  /**
   * Recursively update depths of all descendant sections
   */
  private async updateDescendantDepths(parentId: number, parentDepth: number): Promise<void> {
    const { rows: children } = await this.pool.query(
      'SELECT id FROM wiki.sections WHERE parent_section_id = $1 AND deleted_at IS NULL',
      [parentId]
    );

    for (const child of children) {
      const newDepth = parentDepth + 1;
      await this.pool.query(
        'UPDATE wiki.sections SET depth = $1, updated_at = NOW() WHERE id = $2',
        [newDepth, child.id]
      );
      await this.updateDescendantDepths(child.id, newDepth);
    }
  }

  async remove(id: number, userId: number) {
    const { rows } = await this.pool.query(
      `UPDATE wiki.sections
       SET deleted_at = NOW(),
           deleted_by = $2,
           updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      [id, userId]
    );

    if (rows.length === 0) {
      throw new NotFoundException(`Section with ID ${id} not found`);
    }

    return wrapData(rows[0]);
  }

  /**
   * Get sections as a tree structure for navigation
   */
  async getSectionTree(wikiId: number, user: User | null = null) {
    // First verify wiki exists
    const { rows: wikiRows } = await this.pool.query(
      'SELECT id FROM wiki.wikis WHERE id = $1 AND deleted_at IS NULL',
      [wikiId]
    );

    if (wikiRows.length === 0) {
      throw new NotFoundException(`Wiki with ID ${wikiId} not found`);
    }

    // Get all sections ordered by depth then sort_order
    const { rows } = await this.pool.query(
      `SELECT * FROM wiki.sections
       WHERE wiki_id = $1 AND deleted_at IS NULL
       ORDER BY depth, sort_order, title`,
      [wikiId]
    );

    // Filter by ACL
    const accessible = [];
    for (const section of rows) {
      if (await this.aclService.canAccess(user, 'section', section.id)) {
        accessible.push(section);
      }
    }

    // Build tree structure
    const sectionMap = new Map<number, any>();
    const rootSections: any[] = [];

    // First pass: create all section nodes with children array
    for (const section of accessible) {
      sectionMap.set(section.id, {
        ...section,
        children: [],
      });
    }

    // Second pass: build parent-child relationships
    for (const section of accessible) {
      const node = sectionMap.get(section.id);
      if (section.parent_section_id && sectionMap.has(section.parent_section_id)) {
        sectionMap.get(section.parent_section_id).children.push(node);
      } else {
        rootSections.push(node);
      }
    }

    return {
      data: rootSections,
      meta: { total: accessible.length },
    };
  }
}
