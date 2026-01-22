import { Injectable, Inject, NotFoundException, ConflictException } from '@nestjs/common';
import { Pool } from 'pg';
import { CreateLibraryDto } from './dto/create-library.dto';
import { UpdateLibraryDto } from './dto/update-library.dto';
import { wrapData, wrapCollection } from '../../common/utils/response.util';

@Injectable()
export class StaffLibrariesService {
  constructor(@Inject('DATABASE_POOL') private pool: Pool) {}

  async findAll() {
    const { rows } = await this.pool.query(
      `SELECT l.*,
        (SELECT COUNT(*) FROM wiki.users u
         WHERE u.library_id = l.id AND u.deleted_at IS NULL) as staff_count
       FROM wiki.libraries l
       WHERE l.deleted_at IS NULL
       ORDER BY l.name`
    );

    return wrapCollection(rows.map(this.mapLibrary));
  }

  async findOne(id: number) {
    const { rows } = await this.pool.query(
      `SELECT l.*,
        (SELECT COUNT(*) FROM wiki.users u
         WHERE u.library_id = l.id AND u.deleted_at IS NULL) as staff_count
       FROM wiki.libraries l
       WHERE l.id = $1 AND l.deleted_at IS NULL`,
      [id]
    );

    if (rows.length === 0) {
      throw new NotFoundException(`Library with ID ${id} not found`);
    }

    return wrapData(this.mapLibrary(rows[0]));
  }

  async create(dto: CreateLibraryDto, userId: number) {
    // Check if slug already exists
    const { rows: existing } = await this.pool.query(
      'SELECT id FROM wiki.libraries WHERE slug = $1 AND deleted_at IS NULL',
      [dto.slug]
    );

    if (existing.length > 0) {
      throw new ConflictException(`A library with slug '${dto.slug}' already exists`);
    }

    const { rows } = await this.pool.query(
      `INSERT INTO wiki.libraries (name, slug, created_by, updated_by)
       VALUES ($1, $2, $3, $3)
       RETURNING *`,
      [dto.name, dto.slug, userId]
    );

    // Return with staff_count (0 for new library)
    return wrapData({ ...this.mapLibrary(rows[0]), staffCount: 0 });
  }

  async update(id: number, dto: UpdateLibraryDto, userId: number) {
    // Verify library exists
    await this.findOne(id);

    // If slug is being updated, check for conflicts
    if (dto.slug) {
      const { rows: existing } = await this.pool.query(
        'SELECT id FROM wiki.libraries WHERE slug = $1 AND id != $2 AND deleted_at IS NULL',
        [dto.slug, id]
      );

      if (existing.length > 0) {
        throw new ConflictException(`A library with slug '${dto.slug}' already exists`);
      }
    }

    const updates: string[] = [];
    const values: any[] = [id];
    let paramCount = 2;

    if (dto.name !== undefined) {
      updates.push(`name = $${paramCount}`);
      values.push(dto.name);
      paramCount++;
    }

    if (dto.slug !== undefined) {
      updates.push(`slug = $${paramCount}`);
      values.push(dto.slug);
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
      `UPDATE wiki.libraries
       SET ${updates.join(', ')}
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      values
    );

    if (rows.length === 0) {
      throw new NotFoundException(`Library with ID ${id} not found`);
    }

    // Get staff count for updated library
    const { rows: countRows } = await this.pool.query(
      'SELECT COUNT(*) as count FROM wiki.users WHERE library_id = $1 AND deleted_at IS NULL',
      [id]
    );

    return wrapData({
      ...this.mapLibrary(rows[0]),
      staffCount: parseInt(countRows[0].count, 10),
    });
  }

  async remove(id: number, userId: number) {
    // Verify library exists
    await this.findOne(id);

    // Check if library has any staff assigned
    const { rows: staffRows } = await this.pool.query(
      'SELECT COUNT(*) as count FROM wiki.users WHERE library_id = $1 AND deleted_at IS NULL',
      [id]
    );

    if (parseInt(staffRows[0].count, 10) > 0) {
      throw new ConflictException(
        `Cannot delete library: ${staffRows[0].count} staff member(s) are still assigned to this library`
      );
    }

    const { rows } = await this.pool.query(
      `UPDATE wiki.libraries
       SET deleted_at = NOW(),
           deleted_by = $2,
           updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      [id, userId]
    );

    if (rows.length === 0) {
      throw new NotFoundException(`Library with ID ${id} not found`);
    }

    return wrapData(this.mapLibrary(rows[0]));
  }

  private mapLibrary(row: any) {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      staffCount: row.staff_count !== undefined ? parseInt(row.staff_count, 10) : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
