import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { AccessControlService } from '../access-control/access-control.service';

interface User {
  id?: number;
  role?: string;
  libraryId?: number | null;
}

interface SearchResult {
  id: number;
  title: string;
  content: string;
  slug: string;
  status: string;
  section_id: number;
  section_title: string;
  section_slug: string;
  wiki_id: number;
  wiki_title: string;
  wiki_slug: string;
  rank: number;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class SearchService {
  constructor(
    @Inject('DATABASE_POOL') private pool: Pool,
    private aclService: AccessControlService,
  ) {}

  async search(
    query: string,
    user: User | null,
    limit: number = 20,
    offset: number = 0,
    wikiId?: string,
    sectionId?: string,
  ) {
    // Convert query to tsquery format (simple search)
    const tsQuery = query
      .trim()
      .split(/\s+/)
      .filter(word => word.length > 0)
      .join(' & ');

    if (!tsQuery) {
      return {
        data: [],
        meta: { total: 0, limit, offset, query },
      };
    }

    // Build WHERE clause for optional filters
    const whereConditions = ['p.deleted_at IS NULL'];
    const params: any[] = [tsQuery];
    let paramCount = 2;

    if (wikiId) {
      whereConditions.push(`s.wiki_id = $${paramCount}`);
      params.push(parseInt(wikiId, 10));
      paramCount++;
    }

    if (sectionId) {
      whereConditions.push(`p.section_id = $${paramCount}`);
      params.push(parseInt(sectionId, 10));
      paramCount++;
    }

    const whereClause = whereConditions.join(' AND ');

    // Full-text search query with ranking and metadata
    const { rows } = await this.pool.query(
      `SELECT
        p.id,
        p.title,
        p.content,
        p.slug,
        p.status,
        p.section_id,
        s.title as section_title,
        s.slug as section_slug,
        s.wiki_id,
        w.title as wiki_title,
        w.slug as wiki_slug,
        ts_rank(p.search_vector, to_tsquery('english', $1)) as rank,
        p.created_at,
        p.updated_at
       FROM wiki.pages p
       JOIN wiki.sections s ON p.section_id = s.id
       JOIN wiki.wikis w ON s.wiki_id = w.id
       WHERE ${whereClause}
         AND p.search_vector @@ to_tsquery('english', $1)
         AND s.deleted_at IS NULL
         AND w.deleted_at IS NULL
       ORDER BY rank DESC, p.updated_at DESC
       LIMIT ${limit + 100} OFFSET ${offset}`,
      params,
    );

    // Filter by ACL (only show accessible content)
    const accessibleResults: SearchResult[] = [];
    for (const row of rows) {
      // Skip if we already have enough results
      if (accessibleResults.length >= limit) {
        break;
      }

      // Check if user can access this page
      const canAccess = await this.aclService.canAccess(user, 'page', row.id);

      if (canAccess) {
        // Check if this page is link-shared only (should not be discoverable)
        const isLinkShared = await this.isLinkSharedOnly(row.id);

        if (!isLinkShared) {
          accessibleResults.push(row);
        }
      }
    }

    return {
      data: accessibleResults.map(row => ({
        id: row.id,
        title: row.title,
        slug: row.slug,
        status: row.status,
        excerpt: this.generateExcerpt(row.content, query),
        section: {
          id: row.section_id,
          title: row.section_title,
          slug: row.section_slug,
        },
        wiki: {
          id: row.wiki_id,
          title: row.wiki_title,
          slug: row.wiki_slug,
        },
        rank: parseFloat(row.rank.toString()),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
      meta: {
        total: accessibleResults.length,
        limit,
        offset,
        query,
        hasMore: rows.length > accessibleResults.length,
      },
    };
  }

  /**
   * Check if a page is ONLY accessible via link sharing
   * (has only link-type rules, making it non-discoverable)
   */
  private async isLinkSharedOnly(pageId: number): Promise<boolean> {
    const { rows } = await this.pool.query(
      `SELECT rule_type FROM wiki.access_rules
       WHERE ruleable_type = 'page' AND ruleable_id = $1`,
      [pageId],
    );

    // If no rules, it's public (not link-shared only)
    if (rows.length === 0) {
      return false;
    }

    // Check if ALL rules are link-type
    const allLink = rows.every(rule => rule.rule_type === 'link');
    return allLink;
  }

  /**
   * Generate excerpt with search term context
   */
  private generateExcerpt(content: string, query: string, length: number = 200): string {
    // Strip HTML tags
    const text = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

    if (text.length <= length) {
      return text;
    }

    // Try to find query term in content
    const searchTerms = query.toLowerCase().split(/\s+/);
    const lowerText = text.toLowerCase();

    for (const term of searchTerms) {
      const index = lowerText.indexOf(term);
      if (index !== -1) {
        // Found term, create excerpt around it
        const start = Math.max(0, index - 50);
        const end = Math.min(text.length, index + term.length + 150);
        const excerpt = text.substring(start, end);

        return (start > 0 ? '...' : '') + excerpt + (end < text.length ? '...' : '');
      }
    }

    // If no match found, return beginning
    return text.substring(0, length) + (text.length > length ? '...' : '');
  }
}
