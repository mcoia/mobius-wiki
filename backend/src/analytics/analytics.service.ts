import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class AnalyticsService {
  constructor(@Inject('DATABASE_POOL') private pool: Pool) {}

  /**
   * Track a page view
   */
  async trackPageView(
    pageId: number,
    userId: number | null,
    sessionId: string | null,
    referrer: string | null,
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO wiki.page_views (page_id, user_id, session_id, referrer)
       VALUES ($1, $2, $3, $4)`,
      [pageId, userId, sessionId, referrer],
    );
  }

  /**
   * Get page statistics
   */
  async getPageStats(pageId: number, days?: number) {
    const timeFilter = days
      ? `AND viewed_at >= NOW() - INTERVAL '${days} days'`
      : '';

    const { rows: stats } = await this.pool.query(
      `SELECT
        COUNT(*) as total_views,
        COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL) as unique_users,
        COUNT(DISTINCT session_id) FILTER (WHERE session_id IS NOT NULL) as unique_sessions,
        MAX(viewed_at) as last_viewed_at,
        MIN(viewed_at) as first_viewed_at
       FROM wiki.page_views
       WHERE page_id = $1 ${timeFilter}`,
      [pageId],
    );

    // Get views by day for the period
    const { rows: dailyViews } = await this.pool.query(
      `SELECT
        DATE(viewed_at) as date,
        COUNT(*) as views,
        COUNT(DISTINCT session_id) FILTER (WHERE session_id IS NOT NULL) as unique_sessions
       FROM wiki.page_views
       WHERE page_id = $1 ${timeFilter}
       GROUP BY DATE(viewed_at)
       ORDER BY date DESC
       LIMIT 30`,
      [pageId],
    );

    return {
      pageId,
      period: days ? `last_${days}_days` : 'all_time',
      totalViews: parseInt(stats[0].total_views, 10),
      uniqueUsers: parseInt(stats[0].unique_users, 10),
      uniqueSessions: parseInt(stats[0].unique_sessions, 10),
      lastViewedAt: stats[0].last_viewed_at,
      firstViewedAt: stats[0].first_viewed_at,
      dailyViews: dailyViews.map(row => ({
        date: row.date,
        views: parseInt(row.views, 10),
        uniqueSessions: parseInt(row.unique_sessions, 10),
      })),
    };
  }

  /**
   * Get detailed page view log
   */
  async getPageViewLog(pageId: number, limit: number = 100, offset: number = 0) {
    const { rows } = await this.pool.query(
      `SELECT
        pv.id,
        pv.viewed_at,
        pv.session_id,
        pv.referrer,
        u.id as user_id,
        u.name as user_name,
        u.email as user_email
       FROM wiki.page_views pv
       LEFT JOIN wiki.users u ON pv.user_id = u.id
       WHERE pv.page_id = $1
       ORDER BY pv.viewed_at DESC
       LIMIT $2 OFFSET $3`,
      [pageId, limit, offset],
    );

    const { rows: countRows } = await this.pool.query(
      `SELECT COUNT(*) as total FROM wiki.page_views WHERE page_id = $1`,
      [pageId],
    );

    return {
      data: rows.map(row => ({
        id: row.id,
        viewedAt: row.viewed_at,
        sessionId: row.session_id,
        referrer: row.referrer,
        user: row.user_id
          ? {
              id: row.user_id,
              name: row.user_name,
              email: row.user_email,
            }
          : null,
      })),
      meta: {
        total: parseInt(countRows[0].total, 10),
        limit,
        offset,
      },
    };
  }

  /**
   * Get most popular pages
   */
  async getPopularPages(limit: number = 10, days?: number) {
    const timeFilter = days
      ? `AND pv.viewed_at >= NOW() - INTERVAL '${days} days'`
      : '';

    const { rows } = await this.pool.query(
      `SELECT
        p.id,
        p.title,
        p.slug,
        s.title as section_title,
        s.slug as section_slug,
        w.title as wiki_title,
        w.slug as wiki_slug,
        COUNT(pv.id) as view_count,
        COUNT(DISTINCT pv.session_id) FILTER (WHERE pv.session_id IS NOT NULL) as unique_sessions
       FROM wiki.pages p
       JOIN wiki.page_views pv ON p.id = pv.page_id
       JOIN wiki.sections s ON p.section_id = s.id
       JOIN wiki.wikis w ON s.wiki_id = w.id
       WHERE p.deleted_at IS NULL
         AND s.deleted_at IS NULL
         AND w.deleted_at IS NULL
         ${timeFilter}
       GROUP BY p.id, p.title, p.slug, s.title, s.slug, w.title, w.slug
       ORDER BY view_count DESC
       LIMIT $1`,
      [limit],
    );

    return rows.map(row => ({
      page: {
        id: row.id,
        title: row.title,
        slug: row.slug,
      },
      section: {
        title: row.section_title,
        slug: row.section_slug,
      },
      wiki: {
        title: row.wiki_title,
        slug: row.wiki_slug,
      },
      viewCount: parseInt(row.view_count, 10),
      uniqueSessions: parseInt(row.unique_sessions, 10),
    }));
  }

  /**
   * Get overall platform statistics
   */
  async getOverallStats(days?: number) {
    const timeFilter = days
      ? `WHERE viewed_at >= NOW() - INTERVAL '${days} days'`
      : '';

    const { rows: stats } = await this.pool.query(
      `SELECT
        COUNT(*) as total_views,
        COUNT(DISTINCT page_id) as pages_viewed,
        COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL) as unique_users,
        COUNT(DISTINCT session_id) FILTER (WHERE session_id IS NOT NULL) as unique_sessions
       FROM wiki.page_views
       ${timeFilter}`,
    );

    // Get total content counts
    const { rows: contentCounts } = await this.pool.query(
      `SELECT
        (SELECT COUNT(*) FROM wiki.wikis WHERE deleted_at IS NULL) as total_wikis,
        (SELECT COUNT(*) FROM wiki.sections WHERE deleted_at IS NULL) as total_sections,
        (SELECT COUNT(*) FROM wiki.pages WHERE deleted_at IS NULL) as total_pages,
        (SELECT COUNT(*) FROM wiki.files WHERE deleted_at IS NULL) as total_files`,
    );

    return {
      period: days ? `last_${days}_days` : 'all_time',
      views: {
        total: parseInt(stats[0].total_views, 10),
        pagesViewed: parseInt(stats[0].pages_viewed, 10),
        uniqueUsers: parseInt(stats[0].unique_users, 10),
        uniqueSessions: parseInt(stats[0].unique_sessions, 10),
      },
      content: {
        wikis: parseInt(contentCounts[0].total_wikis, 10),
        sections: parseInt(contentCounts[0].total_sections, 10),
        pages: parseInt(contentCounts[0].total_pages, 10),
        files: parseInt(contentCounts[0].total_files, 10),
      },
    };
  }
}
