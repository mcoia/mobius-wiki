import { Injectable, Inject, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { Pool } from 'pg';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto, ResetPasswordDto } from './dto/update-user.dto';
import { hashPassword, validatePassword } from '../../auth/utils/password.util';
import { wrapData } from '../../common/utils/response.util';
import { AuthService } from '../../auth/auth.service';

@Injectable()
export class AdminUsersService {
  constructor(
    @Inject('DATABASE_POOL') private pool: Pool,
    private authService: AuthService,
  ) {}

  async findAll() {
    const { rows } = await this.pool.query(
      `SELECT id, email, name, role, is_active, created_at, updated_at
       FROM wiki.users
       WHERE role = 'mobius_staff' AND deleted_at IS NULL
       ORDER BY name`
    );

    return {
      data: rows.map(this.mapUser),
      meta: { total: rows.length },
    };
  }

  async findOne(id: number) {
    const { rows } = await this.pool.query(
      `SELECT id, email, name, role, is_active, created_at, updated_at
       FROM wiki.users
       WHERE id = $1 AND role = 'mobius_staff' AND deleted_at IS NULL`,
      [id]
    );

    if (rows.length === 0) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return wrapData(this.mapUser(rows[0]));
  }

  async create(dto: CreateUserDto, adminUserId: number) {
    // Check if email already exists
    const { rows: existing } = await this.pool.query(
      'SELECT id FROM wiki.users WHERE email = $1 AND deleted_at IS NULL',
      [dto.email]
    );

    if (existing.length > 0) {
      throw new ConflictException(`A user with email '${dto.email}' already exists`);
    }

    // Create user with is_active: false and no password (invitation flow)
    const { rows } = await this.pool.query(
      `INSERT INTO wiki.users (email, name, role, is_active, created_by, updated_by)
       VALUES ($1, $2, 'mobius_staff', false, $3, $3)
       RETURNING id, email, name, role, is_active, created_at, updated_at`,
      [dto.email, dto.name, adminUserId]
    );

    const user = rows[0];

    // Generate and send invitation token
    await this.authService.generateInvitationToken(user.id);

    return wrapData({
      ...this.mapUser(user),
      invitationSent: true,
    });
  }

  async update(id: number, dto: UpdateUserDto, adminUserId: number) {
    // First verify user exists and is mobius_staff
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

    updates.push(`updated_by = $${paramCount}`);
    values.push(adminUserId);
    paramCount++;

    updates.push('updated_at = NOW()');

    if (updates.length === 2) {
      // Only updated_by and updated_at, nothing actually changed
      return this.findOne(id);
    }

    const { rows } = await this.pool.query(
      `UPDATE wiki.users
       SET ${updates.join(', ')}
       WHERE id = $1 AND role = 'mobius_staff' AND deleted_at IS NULL
       RETURNING id, email, name, role, is_active, created_at, updated_at`,
      values
    );

    if (rows.length === 0) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return wrapData(this.mapUser(rows[0]));
  }

  async remove(id: number, adminUserId: number) {
    // Verify user exists first
    await this.findOne(id);

    const { rows } = await this.pool.query(
      `UPDATE wiki.users
       SET deleted_at = NOW(),
           deleted_by = $2,
           updated_at = NOW()
       WHERE id = $1 AND role = 'mobius_staff' AND deleted_at IS NULL
       RETURNING id, email, name, role, is_active, created_at, updated_at`,
      [id, adminUserId]
    );

    if (rows.length === 0) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return wrapData(this.mapUser(rows[0]));
  }

  async activate(id: number, adminUserId: number) {
    return this.update(id, { isActive: true }, adminUserId);
  }

  async deactivate(id: number, adminUserId: number) {
    return this.update(id, { isActive: false }, adminUserId);
  }

  async resetPassword(id: number, dto: ResetPasswordDto, adminUserId: number) {
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
       WHERE id = $1 AND role = 'mobius_staff' AND deleted_at IS NULL`,
      [id, passwordHash, adminUserId]
    );

    return { success: true };
  }

  async resendInvitation(id: number) {
    // Verify user exists and is mobius_staff
    await this.findOne(id);

    // Check if user has a pending invitation (is_active: false or no password)
    const { rows } = await this.pool.query(
      `SELECT is_active, password_hash FROM wiki.users WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );

    if (rows.length === 0) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    if (rows[0].is_active && rows[0].password_hash) {
      throw new BadRequestException('User account is already active. Cannot resend invitation.');
    }

    // Resend invitation
    await this.authService.resendInvitation(id);

    return { success: true, message: 'Invitation has been resent successfully.' };
  }

  private mapUser(row: any) {
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
