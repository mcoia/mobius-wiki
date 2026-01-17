import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';

export interface ActiveEditor {
  userId: number;
  displayName: string;
  startedAt: string;
  lastHeartbeat: string;
}

@Injectable()
export class EditSessionsService {
  // Sessions without heartbeat for this duration are considered stale
  private readonly STALE_THRESHOLD_MINUTES = 60;

  constructor(@Inject('DATABASE_POOL') private pool: Pool) {}

  /**
   * Start or refresh an edit session for a user on a page.
   * If an active session exists, updates the heartbeat.
   * If no active session, creates a new one.
   */
  async startOrRefreshSession(pageId: number, userId: number): Promise<void> {
    // First, try to end any stale sessions for this page
    await this.cleanupStaleSessions(pageId);

    // Upsert: create new session or update existing heartbeat
    await this.pool.query(
      `INSERT INTO wiki.page_edit_sessions (page_id, user_id, started_at, last_heartbeat)
       VALUES ($1, $2, NOW(), NOW())
       ON CONFLICT (page_id, user_id) WHERE ended_at IS NULL
       DO UPDATE SET last_heartbeat = NOW()`,
      [pageId, userId]
    );
  }

  /**
   * End an edit session for a user on a page.
   */
  async endSession(pageId: number, userId: number): Promise<void> {
    await this.pool.query(
      `UPDATE wiki.page_edit_sessions
       SET ended_at = NOW()
       WHERE page_id = $1 AND user_id = $2 AND ended_at IS NULL`,
      [pageId, userId]
    );
  }

  /**
   * Get all active editors for a page, optionally excluding a specific user.
   * Only returns sessions with recent heartbeats (not stale).
   */
  async getActiveEditors(pageId: number, excludeUserId?: number): Promise<ActiveEditor[]> {
    // First cleanup stale sessions
    await this.cleanupStaleSessions(pageId);

    let query = `
      SELECT
        es.user_id,
        u.name,
        es.started_at,
        es.last_heartbeat
      FROM wiki.page_edit_sessions es
      JOIN wiki.users u ON es.user_id = u.id
      WHERE es.page_id = $1
        AND es.ended_at IS NULL
        AND es.last_heartbeat > NOW() - INTERVAL '${this.STALE_THRESHOLD_MINUTES} minutes'
    `;

    const params: any[] = [pageId];

    if (excludeUserId !== undefined) {
      query += ` AND es.user_id != $2`;
      params.push(excludeUserId);
    }

    query += ` ORDER BY es.started_at ASC`;

    const { rows } = await this.pool.query(query, params);

    return rows.map(row => ({
      userId: row.user_id,
      displayName: row.name,
      startedAt: row.started_at.toISOString(),
      lastHeartbeat: row.last_heartbeat.toISOString(),
    }));
  }

  /**
   * Mark stale sessions as ended for a specific page.
   * A session is stale if it hasn't received a heartbeat in STALE_THRESHOLD_MINUTES.
   */
  async cleanupStaleSessions(pageId?: number): Promise<number> {
    let query = `
      UPDATE wiki.page_edit_sessions
      SET ended_at = NOW()
      WHERE ended_at IS NULL
        AND last_heartbeat < NOW() - INTERVAL '${this.STALE_THRESHOLD_MINUTES} minutes'
    `;

    const params: any[] = [];

    if (pageId !== undefined) {
      query += ` AND page_id = $1`;
      params.push(pageId);
    }

    const result = await this.pool.query(query, params);
    return result.rowCount || 0;
  }

  /**
   * Check if a specific user has an active edit session on a page.
   */
  async hasActiveSession(pageId: number, userId: number): Promise<boolean> {
    const { rows } = await this.pool.query(
      `SELECT 1 FROM wiki.page_edit_sessions
       WHERE page_id = $1
         AND user_id = $2
         AND ended_at IS NULL
         AND last_heartbeat > NOW() - INTERVAL '${this.STALE_THRESHOLD_MINUTES} minutes'
       LIMIT 1`,
      [pageId, userId]
    );

    return rows.length > 0;
  }
}
