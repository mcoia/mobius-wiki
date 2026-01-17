import { Injectable, Inject, NotFoundException, ConflictException } from '@nestjs/common';
import { Pool } from 'pg';
import { CreateWikiDto } from './dto/create-wiki.dto';
import { UpdateWikiDto } from './dto/update-wiki.dto';
import { generateSlug } from '../common/utils/slug.util';
import { AccessControlService } from '../access-control/access-control.service';
import { wrapData } from '../common/utils/response.util';

interface User {
  id: number;
  role?: string;
  libraryId?: number | null;
}

@Injectable()
export class WikisService {
  constructor(
    @Inject('DATABASE_POOL') private pool: Pool,
    private aclService: AccessControlService,
  ) {}

  async findAll(user: User | null = null, includeDeleted = false) {
    const whereClause = includeDeleted ? '' : 'WHERE deleted_at IS NULL';

    const { rows } = await this.pool.query(
      `SELECT * FROM wiki.wikis ${whereClause} ORDER BY sort_order, title`
    );

    // Filter by ACL
    const accessible = [];
    for (const wiki of rows) {
      if (await this.aclService.canAccess(user, 'wiki', wiki.id)) {
        accessible.push(wiki);
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
      `SELECT * FROM wiki.wikis ${whereClause}`,
      [id]
    );

    if (rows.length === 0) {
      throw new NotFoundException(`Wiki with ID ${id} not found`);
    }

    return wrapData(rows[0]);
  }

  async findBySlug(slug: string, includeDeleted = false) {
    const whereClause = includeDeleted
      ? 'WHERE slug = $1'
      : 'WHERE slug = $1 AND deleted_at IS NULL';

    const { rows } = await this.pool.query(
      `SELECT * FROM wiki.wikis ${whereClause}`,
      [slug]
    );

    if (rows.length === 0) {
      throw new NotFoundException(`Wiki with slug '${slug}' not found`);
    }

    return wrapData(rows[0]);
  }

  async create(dto: CreateWikiDto, userId: number) {
    const slug = dto.slug || generateSlug(dto.title);

    // Check if slug already exists
    const { rows: existing } = await this.pool.query(
      'SELECT id FROM wiki.wikis WHERE slug = $1 AND deleted_at IS NULL',
      [slug]
    );

    if (existing.length > 0) {
      throw new ConflictException(`A wiki with slug '${slug}' already exists`);
    }

    const { rows } = await this.pool.query(
      `INSERT INTO wiki.wikis (title, slug, description, sort_order, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $5)
       RETURNING *`,
      [dto.title, slug, dto.description || null, dto.sortOrder || 0, userId]
    );

    return wrapData(rows[0]);
  }

  async update(id: number, dto: UpdateWikiDto, userId: number) {
    // If slug is being updated, check for conflicts
    if (dto.slug) {
      const { rows: existing } = await this.pool.query(
        'SELECT id FROM wiki.wikis WHERE slug = $1 AND id != $2 AND deleted_at IS NULL',
        [dto.slug, id]
      );

      if (existing.length > 0) {
        throw new ConflictException(`A wiki with slug '${dto.slug}' already exists`);
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
      // Only updated_by and updated_at, nothing actually changed
      return this.findOne(id);
    }

    const { rows } = await this.pool.query(
      `UPDATE wiki.wikis
       SET ${updates.join(', ')}
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      values
    );

    if (rows.length === 0) {
      throw new NotFoundException(`Wiki with ID ${id} not found`);
    }

    return wrapData(rows[0]);
  }

  async remove(id: number, userId: number) {
    const { rows } = await this.pool.query(
      `UPDATE wiki.wikis
       SET deleted_at = NOW(),
           deleted_by = $2,
           updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      [id, userId]
    );

    if (rows.length === 0) {
      throw new NotFoundException(`Wiki with ID ${id} not found`);
    }

    return wrapData(rows[0]);
  }

  async archive(id: number, userId: number) {
    const { rows } = await this.pool.query(
      `UPDATE wiki.wikis
       SET archived_at = NOW(),
           updated_by = $2,
           updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      [id, userId]
    );

    if (rows.length === 0) {
      throw new NotFoundException(`Wiki with ID ${id} not found`);
    }

    return wrapData(rows[0]);
  }

  async unarchive(id: number, userId: number) {
    const { rows } = await this.pool.query(
      `UPDATE wiki.wikis
       SET archived_at = NULL,
           updated_by = $2,
           updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      [id, userId]
    );

    if (rows.length === 0) {
      throw new NotFoundException(`Wiki with ID ${id} not found`);
    }

    return wrapData(rows[0]);
  }
}
