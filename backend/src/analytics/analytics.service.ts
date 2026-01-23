import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';

export interface WikiStats {
  wikiId: number;
  wikiTitle: string;
  wikiSlug: string;
  viewCount: number;
  uniqueSessions: number;
}

export interface SectionStats {
  sectionId: number;
  sectionTitle: string;
  wikiTitle: string;
  viewCount: number;
  uniqueSessions: number;
}

export interface UserContribution {
  userId: number;
  userName: string;
  editCount: number;
  pagesEdited: number;
}

export interface CreationTrend {
  date: string;
  pagesCreated: number;
  versionsCreated: number;
}

export interface ContentHealth {
  orphanedPages: { id: number; title: string; createdAt: string }[];
  stalePages: { id: number; title: string; lastUpdated: string; daysSinceUpdate: number }[];
  draftBacklog: { id: number; title: string; createdAt: string }[];
  neverPublished: { id: number; title: string; createdAt: string }[];
}

export interface ReferrerStats {
  domain: string;
  viewCount: number;
  percentage: number;
}

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
   * Get daily views across the platform
   */
  async getDailyViews(days: number = 30) {
    const { rows } = await this.pool.query(
      `SELECT
        DATE(viewed_at) as date,
        COUNT(*) as views,
        COUNT(DISTINCT session_id) FILTER (WHERE session_id IS NOT NULL) as unique_sessions
       FROM wiki.page_views
       WHERE viewed_at >= NOW() - INTERVAL '${days} days'
       GROUP BY DATE(viewed_at)
       ORDER BY date ASC`,
    );

    return {
      data: rows.map(row => ({
        date: row.date.toISOString().split('T')[0],
        views: parseInt(row.views, 10),
        uniqueSessions: parseInt(row.unique_sessions, 10),
      })),
      meta: {
        period: `last_${days}_days`,
      },
    };
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

  /**
   * Get wiki performance statistics
   */
  async getWikiStats(days?: number): Promise<WikiStats[]> {
    const { rows } = await this.pool.query(
      `SELECT w.id, w.title, w.slug,
              COUNT(pv.id) AS view_count,
              COUNT(DISTINCT pv.session_id) FILTER (WHERE pv.session_id IS NOT NULL) AS unique_sessions
       FROM wiki.wikis w
       LEFT JOIN wiki.sections s ON s.wiki_id = w.id AND s.deleted_at IS NULL
       LEFT JOIN wiki.pages p ON p.section_id = s.id AND p.deleted_at IS NULL
       LEFT JOIN wiki.page_views pv ON pv.page_id = p.id
         AND ($1::int IS NULL OR pv.viewed_at >= NOW() - INTERVAL '1 day' * $1)
       WHERE w.deleted_at IS NULL
       GROUP BY w.id, w.title, w.slug
       ORDER BY view_count DESC`,
      [days || null],
    );

    return rows.map(row => ({
      wikiId: row.id,
      wikiTitle: row.title,
      wikiSlug: row.slug,
      viewCount: parseInt(row.view_count, 10),
      uniqueSessions: parseInt(row.unique_sessions, 10),
    }));
  }

  /**
   * Get section performance statistics
   */
  async getSectionStats(days?: number, limit: number = 10): Promise<SectionStats[]> {
    const { rows } = await this.pool.query(
      `SELECT s.id, s.title AS section_title, w.title AS wiki_title,
              COUNT(pv.id) AS view_count,
              COUNT(DISTINCT pv.session_id) FILTER (WHERE pv.session_id IS NOT NULL) AS unique_sessions
       FROM wiki.sections s
       JOIN wiki.wikis w ON s.wiki_id = w.id AND w.deleted_at IS NULL
       LEFT JOIN wiki.pages p ON p.section_id = s.id AND p.deleted_at IS NULL
       LEFT JOIN wiki.page_views pv ON pv.page_id = p.id
         AND ($1::int IS NULL OR pv.viewed_at >= NOW() - INTERVAL '1 day' * $1)
       WHERE s.deleted_at IS NULL
       GROUP BY s.id, s.title, w.title
       ORDER BY view_count DESC
       LIMIT $2`,
      [days || null, limit],
    );

    return rows.map(row => ({
      sectionId: row.id,
      sectionTitle: row.section_title,
      wikiTitle: row.wiki_title,
      viewCount: parseInt(row.view_count, 10),
      uniqueSessions: parseInt(row.unique_sessions, 10),
    }));
  }

  /**
   * Get user contribution leaderboard
   */
  async getUserContributions(days?: number, limit: number = 10): Promise<UserContribution[]> {
    const { rows } = await this.pool.query(
      `SELECT u.id, u.name,
              COUNT(pv.id) AS edit_count,
              COUNT(DISTINCT pv.page_id) AS pages_edited
       FROM wiki.users u
       JOIN wiki.page_versions pv ON pv.created_by = u.id
       WHERE $1::int IS NULL OR pv.created_at >= NOW() - INTERVAL '1 day' * $1
       GROUP BY u.id, u.name
       ORDER BY edit_count DESC
       LIMIT $2`,
      [days || null, limit],
    );

    return rows.map(row => ({
      userId: row.id,
      userName: row.name,
      editCount: parseInt(row.edit_count, 10),
      pagesEdited: parseInt(row.pages_edited, 10),
    }));
  }

  /**
   * Get content creation trends over time
   */
  async getContentCreationTrends(days: number = 30): Promise<CreationTrend[]> {
    const { rows } = await this.pool.query(
      `WITH dates AS (
        SELECT generate_series(
          DATE(NOW() - INTERVAL '1 day' * $1),
          DATE(NOW()),
          '1 day'::interval
        )::date AS date
      ),
      page_counts AS (
        SELECT DATE(created_at) AS date, COUNT(*) AS count
        FROM wiki.pages
        WHERE created_at >= NOW() - INTERVAL '1 day' * $1
          AND deleted_at IS NULL
        GROUP BY DATE(created_at)
      ),
      version_counts AS (
        SELECT DATE(created_at) AS date, COUNT(*) AS count
        FROM wiki.page_versions
        WHERE created_at >= NOW() - INTERVAL '1 day' * $1
        GROUP BY DATE(created_at)
      )
      SELECT
        d.date,
        COALESCE(pc.count, 0) AS pages_created,
        COALESCE(vc.count, 0) AS versions_created
      FROM dates d
      LEFT JOIN page_counts pc ON pc.date = d.date
      LEFT JOIN version_counts vc ON vc.date = d.date
      ORDER BY d.date ASC`,
      [days],
    );

    return rows.map(row => ({
      date: row.date.toISOString().split('T')[0],
      pagesCreated: parseInt(row.pages_created, 10),
      versionsCreated: parseInt(row.versions_created, 10),
    }));
  }

  /**
   * Get content health metrics (orphaned pages, stale content, drafts)
   */
  async getContentHealth(): Promise<ContentHealth> {
    // Orphaned pages - pages with 0 views
    const { rows: orphanedRows } = await this.pool.query(
      `SELECT p.id, p.title, p.created_at
       FROM wiki.pages p
       LEFT JOIN wiki.page_views pv ON pv.page_id = p.id
       WHERE p.deleted_at IS NULL AND pv.id IS NULL
       ORDER BY p.created_at DESC
       LIMIT 50`,
    );

    // Stale pages - not updated in 90+ days
    const { rows: staleRows } = await this.pool.query(
      `SELECT p.id, p.title, p.updated_at,
              EXTRACT(DAY FROM NOW() - p.updated_at)::int AS days_since_update
       FROM wiki.pages p
       WHERE p.deleted_at IS NULL
         AND p.updated_at < NOW() - INTERVAL '90 days'
       ORDER BY p.updated_at ASC
       LIMIT 50`,
    );

    // Draft backlog - pages that are still in draft status
    const { rows: draftRows } = await this.pool.query(
      `SELECT p.id, p.title, p.created_at
       FROM wiki.pages p
       WHERE p.deleted_at IS NULL
         AND p.status = 'draft'
       ORDER BY p.created_at ASC
       LIMIT 50`,
    );

    // Never published - pages that have never been published (published_at is null)
    const { rows: neverPublishedRows } = await this.pool.query(
      `SELECT p.id, p.title, p.created_at
       FROM wiki.pages p
       WHERE p.deleted_at IS NULL
         AND p.published_at IS NULL
       ORDER BY p.created_at DESC
       LIMIT 50`,
    );

    return {
      orphanedPages: orphanedRows.map(row => ({
        id: row.id,
        title: row.title,
        createdAt: row.created_at.toISOString(),
      })),
      stalePages: staleRows.map(row => ({
        id: row.id,
        title: row.title,
        lastUpdated: row.updated_at.toISOString(),
        daysSinceUpdate: row.days_since_update,
      })),
      draftBacklog: draftRows.map(row => ({
        id: row.id,
        title: row.title,
        createdAt: row.created_at.toISOString(),
      })),
      neverPublished: neverPublishedRows.map(row => ({
        id: row.id,
        title: row.title,
        createdAt: row.created_at.toISOString(),
      })),
    };
  }

  /**
   * Get referrer/traffic source statistics
   */
  async getReferrerStats(days?: number, limit: number = 10): Promise<ReferrerStats[]> {
    const { rows } = await this.pool.query(
      `WITH referrer_counts AS (
        SELECT
          COALESCE(
            CASE WHEN referrer IS NULL OR referrer = '' THEN 'Direct'
                 ELSE SUBSTRING(referrer FROM '://([^/]+)')
            END, 'Direct'
          ) AS domain,
          COUNT(*) AS view_count
        FROM wiki.page_views
        WHERE $1::int IS NULL OR viewed_at >= NOW() - INTERVAL '1 day' * $1
        GROUP BY domain
        ORDER BY view_count DESC
        LIMIT $2
      ),
      total AS (
        SELECT SUM(view_count) AS total_views FROM referrer_counts
      )
      SELECT
        rc.domain,
        rc.view_count,
        ROUND((rc.view_count::numeric / NULLIF(t.total_views, 0) * 100), 1) AS percentage
      FROM referrer_counts rc, total t
      ORDER BY rc.view_count DESC`,
      [days || null, limit],
    );

    return rows.map(row => ({
      domain: row.domain || 'Direct',
      viewCount: parseInt(row.view_count, 10),
      percentage: parseFloat(row.percentage) || 0,
    }));
  }
}
