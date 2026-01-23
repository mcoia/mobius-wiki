import { Injectable, Inject, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { randomBytes } from 'crypto';

import { verifyPassword, hashPassword } from './utils/password.util';
import { UpdateProfileDto, ChangePasswordDto } from './dto/update-profile.dto';
import { MailerService } from '../mailer/mailer.service';
import { generatePasswordResetEmail, generatePasswordResetText } from '../mailer/templates/password-reset';

const TOKEN_EXPIRY_HOURS = 1;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject('DATABASE_POOL') private pool: Pool,
    private mailerService: MailerService,
    private configService: ConfigService,
  ) {}

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

  async forgotPassword(email: string): Promise<{ success: boolean; message: string }> {
    // Always return success to prevent email enumeration attacks
    const successResponse = {
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
    };

    // Find user by email
    const { rows } = await this.pool.query(
      `SELECT id, email, name FROM wiki.users WHERE email = $1 AND is_active = true AND deleted_at IS NULL`,
      [email],
    );

    if (rows.length === 0) {
      // Return same response to prevent timing attacks
      this.logger.log(`Password reset requested for non-existent email: ${email}`);
      return successResponse;
    }

    const user = rows[0];

    // Generate secure token
    const token = this.generateResetToken();
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    // Store token in database
    await this.pool.query(
      `UPDATE wiki.users SET password_reset_token = $1, password_reset_expires_at = $2, updated_at = NOW() WHERE id = $3`,
      [token, expiresAt, user.id],
    );

    // Build reset URL
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:4200');
    const resetUrl = `${frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;

    // Send email
    const emailHtml = generatePasswordResetEmail({
      userName: user.name || user.email,
      resetUrl,
      expiresInHours: TOKEN_EXPIRY_HOURS,
    });

    const emailText = generatePasswordResetText({
      userName: user.name || user.email,
      resetUrl,
      expiresInHours: TOKEN_EXPIRY_HOURS,
    });

    const emailSent = await this.mailerService.sendMail({
      to: user.email,
      subject: 'Password Reset - MOBIUS Wiki',
      html: emailHtml,
      text: emailText,
    });

    if (!emailSent) {
      this.logger.warn(`Failed to send password reset email to ${user.email}`);
    } else {
      this.logger.log(`Password reset email sent to ${user.email}`);
    }

    return successResponse;
  }

  async resetPassword(token: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    // Find user by token
    const { rows } = await this.pool.query(
      `SELECT id, email, password_reset_expires_at
       FROM wiki.users
       WHERE password_reset_token = $1 AND is_active = true AND deleted_at IS NULL`,
      [token],
    );

    if (rows.length === 0) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const user = rows[0];

    // Check if token has expired
    if (!user.password_reset_expires_at || new Date() > new Date(user.password_reset_expires_at)) {
      // Clear the expired token
      await this.pool.query(
        `UPDATE wiki.users SET password_reset_token = NULL, password_reset_expires_at = NULL WHERE id = $1`,
        [user.id],
      );
      throw new BadRequestException('Reset token has expired. Please request a new password reset.');
    }

    // Hash new password
    const passwordHash = await hashPassword(newPassword);

    // Update password and clear reset token (single use)
    await this.pool.query(
      `UPDATE wiki.users
       SET password_hash = $1, password_reset_token = NULL, password_reset_expires_at = NULL, updated_at = NOW()
       WHERE id = $2`,
      [passwordHash, user.id],
    );

    this.logger.log(`Password reset completed for user ${user.email}`);

    return { success: true, message: 'Password has been reset successfully. You can now log in with your new password.' };
  }

  private generateResetToken(): string {
    // Generate 32 random bytes and encode as base64url
    return randomBytes(32).toString('base64url');
  }
}
