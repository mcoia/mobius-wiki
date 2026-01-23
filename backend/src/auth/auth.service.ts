import { Injectable, Inject, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { Pool } from 'pg';
import { verifyPassword, hashPassword } from './utils/password.util';
import { UpdateProfileDto, ChangePasswordDto } from './dto/update-profile.dto';

@Injectable()
export class AuthService {
  constructor(@Inject('DATABASE_POOL') private pool: Pool) {}

  async validateUser(email: string, password: string) {
    const { rows } = await this.pool.query(
      `SELECT id, email, password_hash, name, role, library_id
       FROM wiki.users
       WHERE email = $1 AND is_active = true AND deleted_at IS NULL`,
      [email],
    );

    if (rows.length === 0) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const user = rows[0];
    const valid = await verifyPassword(password, user.password_hash);

    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const { password_hash, ...result } = user;
    return result;
  }

  async login(req: any, user: any) {
    req.session.userId = user.id;
    req.session.email = user.email;
    req.session.name = user.name;
    req.session.role = user.role;
    req.session.libraryId = user.library_id;
    req.session.loginAt = new Date().toISOString();
  }

  async logout(req: any) {
    return new Promise<void>((resolve, reject) => {
      req.session.destroy((err: any) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async updateProfile(userId: number, dto: UpdateProfileDto, req: any) {
    // Check if email is being changed and if it's already taken
    if (dto.email) {
      const { rows: existing } = await this.pool.query(
        `SELECT id FROM wiki.users WHERE email = $1 AND id != $2 AND deleted_at IS NULL`,
        [dto.email, userId],
      );
      if (existing.length > 0) {
        throw new BadRequestException('Email is already in use');
      }
    }

    // Build dynamic update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (dto.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(dto.name);
    }

    if (dto.email !== undefined) {
      updates.push(`email = $${paramIndex++}`);
      values.push(dto.email);
    }

    if (updates.length === 0) {
      throw new BadRequestException('No fields to update');
    }

    updates.push(`updated_at = NOW()`);
    values.push(userId);

    const { rows } = await this.pool.query(
      `UPDATE wiki.users SET ${updates.join(', ')} WHERE id = $${paramIndex} AND deleted_at IS NULL
       RETURNING id, email, name, role, library_id`,
      values,
    );

    if (rows.length === 0) {
      throw new BadRequestException('User not found');
    }

    const user = rows[0];

    // Update session with new values
    if (dto.name !== undefined) {
      req.session.name = user.name;
    }
    if (dto.email !== undefined) {
      req.session.email = user.email;
    }

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        libraryId: user.library_id,
      },
    };
  }

  async changePassword(userId: number, dto: ChangePasswordDto) {
    // Fetch user with password hash
    const { rows } = await this.pool.query(
      `SELECT id, password_hash FROM wiki.users WHERE id = $1 AND is_active = true AND deleted_at IS NULL`,
      [userId],
    );

    if (rows.length === 0) {
      throw new BadRequestException('User not found');
    }

    const user = rows[0];

    // Verify current password
    const valid = await verifyPassword(dto.currentPassword, user.password_hash);
    if (!valid) {
      throw new BadRequestException('Current password is incorrect');
    }

    // Hash new password
    const newHash = await hashPassword(dto.newPassword);

    // Update password
    await this.pool.query(
      `UPDATE wiki.users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
      [newHash, userId],
    );

    return { success: true, message: 'Password changed successfully' };
  }
}
