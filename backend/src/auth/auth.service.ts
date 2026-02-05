import { Injectable, Inject, UnauthorizedException, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { randomBytes } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

import { verifyPassword, hashPassword, validatePassword } from './utils/password.util';
import { UpdateProfileDto, ChangePasswordDto } from './dto/update-profile.dto';
import { MailerService } from '../mailer/mailer.service';
import { generatePasswordResetEmail, generatePasswordResetText } from '../mailer/templates/password-reset';
import { generateAccountInvitationEmail, generateAccountInvitationText } from '../mailer/templates/account-invitation';

const TOKEN_EXPIRY_HOURS = 1;
const DEFAULT_INVITATION_EXPIRY_DAYS = 7;

// Allowed avatar MIME types
const AVATAR_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];

// Max avatar file size: 5MB
const AVATAR_MAX_SIZE_BYTES = 5 * 1024 * 1024;

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
      `SELECT u.id, u.email, u.password_hash, u.name, u.role, u.library_id, u.avatar_file_id,
              f.storage_path as avatar_storage_path
       FROM wiki.users u
       LEFT JOIN wiki.files f ON u.avatar_file_id = f.id AND f.deleted_at IS NULL
       WHERE u.email = $1 AND u.is_active = true AND u.deleted_at IS NULL`,
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

    const { password_hash, avatar_storage_path, ...result } = user;
    return {
      ...result,
      avatarUrl: avatar_storage_path ? `/api/v1/files/${result.avatar_file_id}/download` : null,
    };
  }

  async login(req: any, user: any) {
    req.session.userId = user.id;
    req.session.email = user.email;
    req.session.name = user.name;
    req.session.role = user.role;
    req.session.libraryId = user.library_id;
    req.session.avatarUrl = user.avatarUrl;
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

    // Fire-and-forget: don't block the response waiting for email
    this.mailerService.sendMail({
      to: user.email,
      subject: 'Password Reset - MOBIUS Wiki',
      html: emailHtml,
      text: emailText,
    }).then(sent => {
      if (sent) {
        this.logger.log(`Password reset email sent to ${user.email}`);
      } else {
        this.logger.warn(`Failed to send password reset email to ${user.email}`);
      }
    }).catch(err => {
      this.logger.error(`Error sending password reset email to ${user.email}: ${err.message}`);
    });

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

  /**
   * Send password reset email to a user by their ID (for admin-initiated resets)
   */
  async sendPasswordResetEmailByUserId(userId: number): Promise<{ success: boolean; message: string }> {
    // Find user by ID (must be active)
    const { rows } = await this.pool.query(
      `SELECT id, email, name FROM wiki.users
       WHERE id = $1 AND is_active = true AND deleted_at IS NULL`,
      [userId],
    );

    if (rows.length === 0) {
      throw new NotFoundException('User not found or inactive');
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

    // Fire-and-forget: don't block the response waiting for email
    this.mailerService.sendMail({
      to: user.email,
      subject: 'Password Reset - MOBIUS Wiki',
      html: emailHtml,
      text: emailText,
    }).then(sent => {
      if (sent) {
        this.logger.log(`Password reset email sent to ${user.email} (admin-initiated)`);
      } else {
        this.logger.warn(`Failed to send password reset email to ${user.email}`);
      }
    }).catch(err => {
      this.logger.error(`Error sending password reset email to ${user.email}: ${err.message}`);
    });

    return { success: true, message: 'Password reset email has been sent.' };
  }

  private generateResetToken(): string {
    // Generate 32 random bytes and encode as base64url
    return randomBytes(32).toString('base64url');
  }

  /**
   * Get the invitation expiry days from settings or use default
   */
  private async getInvitationExpiryDays(): Promise<number> {
    try {
      const { rows } = await this.pool.query(
        `SELECT value FROM wiki.settings WHERE key = 'invitation_expiry_days'`
      );
      if (rows.length > 0) {
        const days = parseInt(rows[0].value, 10);
        if (!isNaN(days) && days > 0) {
          return days;
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to get invitation_expiry_days setting: ${error.message}`);
    }
    return DEFAULT_INVITATION_EXPIRY_DAYS;
  }

  /**
   * Generate an invitation token for a user and send the invitation email
   */
  async generateInvitationToken(userId: number): Promise<{ token: string; expiresAt: Date }> {
    // Get user details
    const { rows } = await this.pool.query(
      `SELECT id, email, name FROM wiki.users WHERE id = $1 AND deleted_at IS NULL`,
      [userId]
    );

    if (rows.length === 0) {
      throw new BadRequestException('User not found');
    }

    const user = rows[0];

    // Generate secure token
    const token = this.generateResetToken();
    const expiryDays = await this.getInvitationExpiryDays();
    const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

    // Store token in database
    await this.pool.query(
      `UPDATE wiki.users SET invitation_token = $1, invitation_expires_at = $2, updated_at = NOW() WHERE id = $3`,
      [token, expiresAt, userId]
    );

    // Build invitation URL
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:4200');
    const invitationUrl = `${frontendUrl}/set-password?token=${encodeURIComponent(token)}`;

    // Send invitation email
    const emailHtml = generateAccountInvitationEmail({
      userName: user.name || user.email,
      invitationUrl,
      expiresInDays: expiryDays,
    });

    const emailText = generateAccountInvitationText({
      userName: user.name || user.email,
      invitationUrl,
      expiresInDays: expiryDays,
    });

    // Fire-and-forget: don't block the response waiting for email
    this.mailerService.sendMail({
      to: user.email,
      subject: "You're Invited to MOBIUS Wiki",
      html: emailHtml,
      text: emailText,
    }).then(sent => {
      if (sent) {
        this.logger.log(`Invitation email sent to ${user.email}`);
      } else {
        this.logger.warn(`Failed to send invitation email to ${user.email}`);
      }
    }).catch(err => {
      this.logger.error(`Error sending invitation email to ${user.email}: ${err.message}`);
    });

    return { token, expiresAt };
  }

  /**
   * Validate an invitation token without consuming it
   */
  async validateInvitationToken(token: string): Promise<{ valid: boolean; email?: string; name?: string }> {
    const { rows } = await this.pool.query(
      `SELECT id, email, name, invitation_expires_at
       FROM wiki.users
       WHERE invitation_token = $1 AND deleted_at IS NULL`,
      [token]
    );

    if (rows.length === 0) {
      return { valid: false };
    }

    const user = rows[0];

    // Check if token has expired
    if (!user.invitation_expires_at || new Date() > new Date(user.invitation_expires_at)) {
      return { valid: false };
    }

    return { valid: true, email: user.email, name: user.name };
  }

  /**
   * Accept an invitation and set the user's password
   */
  async acceptInvitation(token: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    // Find user by invitation token
    const { rows } = await this.pool.query(
      `SELECT id, email, invitation_expires_at
       FROM wiki.users
       WHERE invitation_token = $1 AND deleted_at IS NULL`,
      [token]
    );

    if (rows.length === 0) {
      throw new BadRequestException('Invalid or expired invitation token');
    }

    const user = rows[0];

    // Check if token has expired
    if (!user.invitation_expires_at || new Date() > new Date(user.invitation_expires_at)) {
      // Clear the expired token
      await this.pool.query(
        `UPDATE wiki.users SET invitation_token = NULL, invitation_expires_at = NULL WHERE id = $1`,
        [user.id]
      );
      throw new BadRequestException('Invitation has expired. Please contact your administrator to request a new invitation.');
    }

    // Validate password meets policy
    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      throw new BadRequestException(validation.error);
    }

    // Hash new password
    const passwordHash = await hashPassword(newPassword);

    // Update user: set password, activate account, clear invitation token
    await this.pool.query(
      `UPDATE wiki.users
       SET password_hash = $1,
           is_active = true,
           invitation_token = NULL,
           invitation_expires_at = NULL,
           updated_at = NOW()
       WHERE id = $2`,
      [passwordHash, user.id]
    );

    this.logger.log(`Invitation accepted for user ${user.email}`);

    return { success: true, message: 'Your password has been set successfully. You can now log in.' };
  }

  /**
   * Resend an invitation to a user with a pending invitation
   */
  async resendInvitation(userId: number): Promise<{ success: boolean; message: string }> {
    // Verify user exists and has a pending invitation (is_active: false, no password)
    const { rows } = await this.pool.query(
      `SELECT id, email, name, is_active, password_hash
       FROM wiki.users
       WHERE id = $1 AND deleted_at IS NULL`,
      [userId]
    );

    if (rows.length === 0) {
      throw new BadRequestException('User not found');
    }

    const user = rows[0];

    // User should be inactive or have no password set to receive a new invitation
    if (user.is_active && user.password_hash) {
      throw new BadRequestException('User account is already active. Cannot resend invitation.');
    }

    // Generate new invitation token and send email
    await this.generateInvitationToken(userId);

    return { success: true, message: 'Invitation has been resent successfully.' };
  }

  /**
   * Get avatar URL for a user by ID
   */
  async getAvatarUrl(userId: number): Promise<string | null> {
    const { rows } = await this.pool.query(
      `SELECT u.avatar_file_id, f.storage_path
       FROM wiki.users u
       LEFT JOIN wiki.files f ON u.avatar_file_id = f.id AND f.deleted_at IS NULL
       WHERE u.id = $1 AND u.deleted_at IS NULL`,
      [userId]
    );

    if (rows.length === 0 || !rows[0].avatar_file_id) {
      return null;
    }

    return `/api/v1/files/${rows[0].avatar_file_id}/download`;
  }

  /**
   * Upload a new avatar for the current user
   */
  async uploadAvatar(
    userId: number,
    file: Express.Multer.File,
    req: any
  ): Promise<{ success: boolean; user: any }> {
    // Validate file type
    if (!AVATAR_ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type. Allowed types: JPG, PNG, GIF, WebP`
      );
    }

    // Validate file size
    if (file.size > AVATAR_MAX_SIZE_BYTES) {
      const maxMb = AVATAR_MAX_SIZE_BYTES / (1024 * 1024);
      throw new BadRequestException(
        `File size exceeds maximum allowed size (${maxMb} MB)`
      );
    }

    // Get current user to check for existing avatar
    const { rows: userRows } = await this.pool.query(
      `SELECT avatar_file_id FROM wiki.users WHERE id = $1 AND deleted_at IS NULL`,
      [userId]
    );

    if (userRows.length === 0) {
      throw new BadRequestException('User not found');
    }

    const oldAvatarFileId = userRows[0].avatar_file_id;

    // Generate unique filename
    const fileHash = randomBytes(16).toString('hex');
    const ext = path.extname(file.originalname) || '.jpg';
    const filename = `avatar_${userId}_${fileHash}${ext}`;
    const storagePath = `uploads/${filename}`;
    const uploadDir = path.join(process.cwd(), 'uploads');
    const fullPath = path.join(uploadDir, filename);

    // Ensure upload directory exists
    try {
      await fs.access(uploadDir);
    } catch {
      await fs.mkdir(uploadDir, { recursive: true });
    }

    // Save file to disk
    await fs.writeFile(fullPath, file.buffer);

    // Insert file record
    const { rows: fileRows } = await this.pool.query(
      `INSERT INTO wiki.files (filename, storage_path, mime_type, size_bytes, uploaded_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [file.originalname, storagePath, file.mimetype, file.size, userId]
    );

    const newFileId = fileRows[0].id;

    // Update user's avatar_file_id
    const { rows: updatedRows } = await this.pool.query(
      `UPDATE wiki.users
       SET avatar_file_id = $1, updated_at = NOW()
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING id, email, name, role, library_id, avatar_file_id`,
      [newFileId, userId]
    );

    // Soft-delete old avatar file if it exists
    if (oldAvatarFileId) {
      await this.pool.query(
        `UPDATE wiki.files SET deleted_at = NOW(), deleted_by = $1 WHERE id = $2`,
        [userId, oldAvatarFileId]
      );
    }

    const user = updatedRows[0];
    const avatarUrl = `/api/v1/files/${newFileId}/download`;

    // Update session
    req.session.avatarUrl = avatarUrl;

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        libraryId: user.library_id,
        avatarUrl,
      },
    };
  }

  /**
   * Remove the current user's avatar
   */
  async removeAvatar(userId: number, req: any): Promise<{ success: boolean; user: any }> {
    // Get current user's avatar
    const { rows: userRows } = await this.pool.query(
      `SELECT avatar_file_id FROM wiki.users WHERE id = $1 AND deleted_at IS NULL`,
      [userId]
    );

    if (userRows.length === 0) {
      throw new BadRequestException('User not found');
    }

    const avatarFileId = userRows[0].avatar_file_id;

    if (!avatarFileId) {
      throw new BadRequestException('No avatar to remove');
    }

    // Clear user's avatar_file_id and soft-delete the file
    const { rows: updatedRows } = await this.pool.query(
      `UPDATE wiki.users
       SET avatar_file_id = NULL, updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id, email, name, role, library_id`,
      [userId]
    );

    // Soft-delete the file
    await this.pool.query(
      `UPDATE wiki.files SET deleted_at = NOW(), deleted_by = $1 WHERE id = $2`,
      [userId, avatarFileId]
    );

    const user = updatedRows[0];

    // Update session
    req.session.avatarUrl = null;

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        libraryId: user.library_id,
        avatarUrl: null,
      },
    };
  }
}
