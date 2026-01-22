import { Injectable, Inject, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { Pool } from 'pg';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto, ResetPasswordDto } from './dto/update-user.dto';
import { hashPassword, validatePassword } from '../../auth/utils/password.util';
import { wrapData, wrapCollection } from '../../common/utils/response.util';

@Injectable()
export class StaffUsersService {
  constructor(@Inject('DATABASE_POOL') private pool: Pool) {}

  async findAll() {
    const { rows } = await this.pool.query(
      `SELECT u.id, u.email, u.name, u.role, u.is_active, u.library_id,
              u.created_at, u.updated_at,
              l.name as library_name
       FROM wiki.users u
       LEFT JOIN wiki.libraries l ON u.library_id = l.id
       WHERE u.role = 'library_staff' AND u.deleted_at IS NULL
       ORDER BY u.name`
    );

    return wrapCollection(rows.map(this.mapUser));
  }

  async findOne(id: number) {
    const { rows } = await this.pool.query(
      `SELECT u.id, u.email, u.name, u.role, u.is_active, u.library_id,
              u.created_at, u.updated_at,
              l.name as library_name
       FROM wiki.users u
       LEFT JOIN wiki.libraries l ON u.library_id = l.id
       WHERE u.id = $1 AND u.role = 'library_staff' AND u.deleted_at IS NULL`,
      [id]
    );

    if (rows.length === 0) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return wrapData(this.mapUser(rows[0]));
  }

  async create(dto: CreateUserDto, staffUserId: number) {
    // Validate password meets policy
    const validation = validatePassword(dto.password);
    if (!validation.valid) {
      throw new BadRequestException(validation.error);
    }

    // Check if email already exists
    const { rows: existing } = await this.pool.query(
      'SELECT id FROM wiki.users WHERE email = $1 AND deleted_at IS NULL',
      [dto.email]
    );

    if (existing.length > 0) {
      throw new ConflictException(`A user with email '${dto.email}' already exists`);
    }

    // Verify library exists
    const { rows: libraryRows } = await this.pool.query(
      'SELECT id, name FROM wiki.libraries WHERE id = $1 AND deleted_at IS NULL',
      [dto.libraryId]
    );

    if (libraryRows.length === 0) {
      throw new BadRequestException(`Library with ID ${dto.libraryId} not found`);
    }

    const passwordHash = await hashPassword(dto.password);

    const { rows } = await this.pool.query(
      `INSERT INTO wiki.users (email, password_hash, name, role, library_id, is_active, created_by, updated_by)
       VALUES ($1, $2, $3, 'library_staff', $4, true, $5, $5)
       RETURNING id, email, name, role, is_active, library_id, created_at, updated_at`,
      [dto.email, passwordHash, dto.name, dto.libraryId, staffUserId]
    );

    return wrapData({
      ...this.mapUser(rows[0]),
      libraryName: libraryRows[0].name,
    });
  }

  async update(id: number, dto: UpdateUserDto, staffUserId: number) {
    // First verify user exists and is library_staff
    await this.findOne(id);

    // If email is being updated, check for conflicts
    if (dto.email) {
      const { rows: existing } = await this.pool.query(
        'SELECT id FROM wiki.users WHERE email = $1 AND id != $2 AND deleted_at IS NULL',
        [dto.email, id]
      );

      if (existing.length > 0) {
        throw new ConflictException(`A user with email '${dto.email}' already exists`);
      }
    }

    // If libraryId is being updated, verify it exists
    if (dto.libraryId) {
      const { rows: libraryRows } = await this.pool.query(
        'SELECT id FROM wiki.libraries WHERE id = $1 AND deleted_at IS NULL',
        [dto.libraryId]
      );

      if (libraryRows.length === 0) {
        throw new BadRequestException(`Library with ID ${dto.libraryId} not found`);
      }
    }

    const updates: string[] = [];
    const values: any[] = [id];
    let paramCount = 2;

    if (dto.email !== undefined) {
      updates.push(`email = $${paramCount}`);
      values.push(dto.email);
      paramCount++;
    }

    if (dto.name !== undefined) {
      updates.push(`name = $${paramCount}`);
      values.push(dto.name);
      paramCount++;
    }

    if (dto.isActive !== undefined) {
      updates.push(`is_active = $${paramCount}`);
      values.push(dto.isActive);
      paramCount++;
    }

    if (dto.libraryId !== undefined) {
      updates.push(`library_id = $${paramCount}`);
      values.push(dto.libraryId);
      paramCount++;
    }

    updates.push(`updated_by = $${paramCount}`);
    values.push(staffUserId);
    paramCount++;

    updates.push('updated_at = NOW()');

    if (updates.length === 2) {
      // Only updated_by and updated_at, nothing actually changed
      return this.findOne(id);
    }

    const { rows } = await this.pool.query(
      `UPDATE wiki.users
       SET ${updates.join(', ')}
       WHERE id = $1 AND role = 'library_staff' AND deleted_at IS NULL
       RETURNING id, email, name, role, is_active, library_id, created_at, updated_at`,
      values
    );

    if (rows.length === 0) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Get library name for response
    const { rows: libraryRows } = await this.pool.query(
      'SELECT name FROM wiki.libraries WHERE id = $1',
      [rows[0].library_id]
    );

    return wrapData({
      ...this.mapUser(rows[0]),
      libraryName: libraryRows[0]?.name || null,
    });
  }

  async remove(id: number, staffUserId: number) {
    // Verify user exists first
    await this.findOne(id);

    const { rows } = await this.pool.query(
      `UPDATE wiki.users
       SET deleted_at = NOW(),
           deleted_by = $2,
           updated_at = NOW()
       WHERE id = $1 AND role = 'library_staff' AND deleted_at IS NULL
       RETURNING id, email, name, role, is_active, library_id, created_at, updated_at`,
      [id, staffUserId]
    );

    if (rows.length === 0) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return wrapData(this.mapUser(rows[0]));
  }

  async activate(id: number, staffUserId: number) {
    return this.update(id, { isActive: true }, staffUserId);
  }

  async deactivate(id: number, staffUserId: number) {
    return this.update(id, { isActive: false }, staffUserId);
  }

  async resetPassword(id: number, dto: ResetPasswordDto, staffUserId: number) {
    // Verify user exists first
    await this.findOne(id);

    // Validate password meets policy
    const validation = validatePassword(dto.password);
    if (!validation.valid) {
      throw new BadRequestException(validation.error);
    }

    const passwordHash = await hashPassword(dto.password);

    await this.pool.query(
      `UPDATE wiki.users
       SET password_hash = $2,
           updated_by = $3,
           updated_at = NOW()
       WHERE id = $1 AND role = 'library_staff' AND deleted_at IS NULL`,
      [id, passwordHash, staffUserId]
    );

    return { success: true };
  }

  private mapUser(row: any) {
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      isActive: row.is_active,
      libraryId: row.library_id,
      libraryName: row.library_name || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
