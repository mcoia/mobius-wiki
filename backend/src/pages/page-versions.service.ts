import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class PageVersionsService {
  constructor(@Inject('DATABASE_POOL') private pool: Pool) {}

  async createVersion(
    pageId: number,
    title: string,
    content: string,
    scripts: string | null,
    userId: number
  ) {
    // Get next version number
    const { rows: versionRows } = await this.pool.query(
      'SELECT COALESCE(MAX(version_number), 0) + 1 as next_version FROM wiki.page_versions WHERE page_id = $1',
      [pageId]
    );

    const nextVersion = versionRows[0].next_version;

    // Create new version
    const { rows } = await this.pool.query(
      `INSERT INTO wiki.page_versions (page_id, content, scripts, title, version_number, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [pageId, content, scripts, title, nextVersion, userId]
    );

    return rows[0];
  }

  async findAllForPage(pageId: number) {
    const { rows } = await this.pool.query(
      `SELECT * FROM wiki.page_versions
       WHERE page_id = $1
       ORDER BY version_number DESC`,
      [pageId]
    );

    return {
      data: rows,
      meta: { total: rows.length },
    };
  }

  async findOne(pageId: number, versionNumber: number) {
    const { rows } = await this.pool.query(
      `SELECT * FROM wiki.page_versions
       WHERE page_id = $1 AND version_number = $2`,
      [pageId, versionNumber]
    );

    if (rows.length === 0) {
      throw new NotFoundException(
        `Version ${versionNumber} not found for page ${pageId}`
      );
    }

    return rows[0];
  }
}
