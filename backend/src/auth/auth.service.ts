import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { Pool } from 'pg';
import { verifyPassword } from './utils/password.util';

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
}
