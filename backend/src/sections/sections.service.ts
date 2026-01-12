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

    // Check if slug exists in this wiki
    const { rows: existing } = await this.pool.query(
      'SELECT id FROM wiki.sections WHERE wiki_id = $1 AND slug = $2 AND deleted_at IS NULL',
      [wikiId, slug]
    );

    if (existing.length > 0) {
      throw new ConflictException(`A section with slug '${slug}' already exists in this wiki`);
    }

    // Get max sort_order for this wiki to ensure chronological ordering
    const { rows: maxOrderRows } = await this.pool.query(
      'SELECT COALESCE(MAX(sort_order), -1) as max_order FROM wiki.sections WHERE wiki_id = $1 AND deleted_at IS NULL',
      [wikiId]
    );
    const sortOrder = dto.sortOrder ?? (maxOrderRows[0].max_order + 1);

    const { rows } = await this.pool.query(
      `INSERT INTO wiki.sections (wiki_id, title, slug, description, sort_order, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $6)
       RETURNING *`,
      [wikiId, dto.title, slug, dto.description || null, sortOrder, userId]
    );

    return wrapData(rows[0]);
  }

  async update(id: number, dto: UpdateSectionDto, userId: number) {
    // If slug is being updated, check for conflicts within the same wiki
    if (dto.slug) {
      const { rows: sectionRows } = await this.pool.query(
        'SELECT wiki_id FROM wiki.sections WHERE id = $1 AND deleted_at IS NULL',
        [id]
      );

      if (sectionRows.length === 0) {
        throw new NotFoundException(`Section with ID ${id} not found`);
      }

      const wikiId = sectionRows[0].wiki_id;

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

    return wrapData(rows[0]);
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
}
