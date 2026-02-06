import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';

export type FileAuditAction =
  | 'upload'
  | 'download'
  | 'delete'
  | 'restore'
  | 'replace'
  | 'link'
  | 'unlink'
  | 'access_rule_add'
  | 'access_rule_remove'
  | 'metadata_update';

export interface AuditLogEntry {
  id: number;
  file_id: number | null;
  action: FileAuditAction;
  actor_id: number | null;
  actor_name?: string;
  actor_email?: string;
  details: Record<string, any> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

@Injectable()
export class FileAuditService {
  constructor(@Inject('DATABASE_POOL') private pool: Pool) {}

  /**
   * Log a file audit event
   */
  async log(
    fileId: number | null,
    action: FileAuditAction,
    actorId: number | null,
    details?: Record<string, any>,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuditLogEntry> {
    const { rows } = await this.pool.query(
      `INSERT INTO wiki.file_audit_logs (file_id, action, actor_id, details, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        fileId,
        action,
        actorId,
        details ? JSON.stringify(details) : null,
        ipAddress || null,
        userAgent || null,
      ],
    );

    return rows[0];
  }

  /**
   * Get audit logs for a specific file
   */
  async getLogsForFile(fileId: number, limit = 50): Promise<AuditLogEntry[]> {
    const { rows } = await this.pool.query(
      `SELECT
        l.*,
        u.name as actor_name,
        u.email as actor_email
       FROM wiki.file_audit_logs l
       LEFT JOIN wiki.users u ON l.actor_id = u.id
       WHERE l.file_id = $1
       ORDER BY l.created_at DESC
       LIMIT $2`,
      [fileId, limit],
    );

    return rows;
  }

  /**
   * Get recent audit logs across all files
   */
  async getRecentLogs(limit = 100): Promise<AuditLogEntry[]> {
    const { rows } = await this.pool.query(
      `SELECT
        l.*,
        u.name as actor_name,
        u.email as actor_email,
        f.filename as file_name
       FROM wiki.file_audit_logs l
       LEFT JOIN wiki.users u ON l.actor_id = u.id
       LEFT JOIN wiki.files f ON l.file_id = f.id
       ORDER BY l.created_at DESC
       LIMIT $1`,
      [limit],
    );

    return rows;
  }

  /**
   * Get audit logs by actor
   */
  async getLogsByActor(actorId: number, limit = 50): Promise<AuditLogEntry[]> {
    const { rows } = await this.pool.query(
      `SELECT
        l.*,
        f.filename as file_name
       FROM wiki.file_audit_logs l
       LEFT JOIN wiki.files f ON l.file_id = f.id
       WHERE l.actor_id = $1
       ORDER BY l.created_at DESC
       LIMIT $2`,
      [actorId, limit],
    );

    return rows;
  }
}
