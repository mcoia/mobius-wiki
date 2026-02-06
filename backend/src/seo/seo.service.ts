import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';

interface SitemapEntry {
  loc: string;
  lastmod: string;
  priority: string;
  changefreq: string;
}

@Injectable()
export class SeoService {
  private sitemapCache: string | null = null;
  private sitemapCacheTime: number = 0;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(@Inject('DATABASE_POOL') private pool: Pool) {}

  /**
   * Generate robots.txt content
   */
  getRobotsTxt(): string {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';

    return `# MOBIUS Wiki Robots.txt
User-agent: *
Allow: /wiki/
Allow: /
Disallow: /admin/
Disallow: /staff/
Disallow: /login
Disallow: /api/

# Sitemap
Sitemap: ${frontendUrl}/sitemap.xml
`;
  }

  /**
   * Generate sitemap.xml content with caching
   */
  async getSitemapXml(): Promise<string> {
    const now = Date.now();

    // Return cached version if still valid
    if (this.sitemapCache && (now - this.sitemapCacheTime) < this.CACHE_TTL_MS) {
      return this.sitemapCache;
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
    const entries: SitemapEntry[] = [];

    // Homepage
    entries.push({
      loc: frontendUrl,
      lastmod: new Date().toISOString().split('T')[0],
      priority: '1.0',
      changefreq: 'daily'
    });

    // Wiki list page
    entries.push({
      loc: `${frontendUrl}/wikis`,
      lastmod: new Date().toISOString().split('T')[0],
      priority: '0.9',
      changefreq: 'daily'
    });

    // Fetch public wikis
    const wikis = await this.getPublicWikis();
    for (const wiki of wikis) {
      entries.push({
        loc: `${frontendUrl}/wiki/${wiki.slug}`,
        lastmod: wiki.updated_at,
        priority: '0.8',
        changefreq: 'weekly'
      });
    }

    // Fetch public sections
    const sections = await this.getPublicSections();
    for (const section of sections) {
      entries.push({
        loc: `${frontendUrl}/wiki/${section.wiki_slug}/${section.slug}`,
        lastmod: section.updated_at,
        priority: '0.7',
        changefreq: 'weekly'
      });
    }

    // Fetch public pages
    const pages = await this.getPublicPages();
    for (const page of pages) {
      entries.push({
        loc: `${frontendUrl}/wiki/${page.wiki_slug}/${page.section_slug}/${page.slug}`,
        lastmod: page.updated_at,
        priority: '0.6',
        changefreq: 'weekly'
      });
    }

    // Build XML
    const xml = this.buildSitemapXml(entries);

    // Cache the result
    this.sitemapCache = xml;
    this.sitemapCacheTime = now;

    return xml;
  }

  /**
   * Fetch public wikis (wikis with public access rule)
   */
  private async getPublicWikis(): Promise<Array<{ slug: string; updated_at: string }>> {
    const query = `
      SELECT w.slug, TO_CHAR(w.updated_at, 'YYYY-MM-DD') as updated_at
      FROM wiki.wikis w
      WHERE w.deleted_at IS NULL
        AND w.archived_at IS NULL
        AND EXISTS (
          SELECT 1 FROM wiki.access_rules ar
          WHERE ar.ruleable_type = 'wiki'
            AND ar.ruleable_id = w.id
            AND ar.rule_type = 'public'
        )
      ORDER BY w.updated_at DESC
    `;

    const result = await this.pool.query(query);
    return result.rows;
  }

  /**
   * Fetch public sections (sections in public wikis without restrictive override)
   */
  private async getPublicSections(): Promise<Array<{ slug: string; wiki_slug: string; updated_at: string }>> {
    const query = `
      SELECT s.slug, w.slug as wiki_slug, TO_CHAR(GREATEST(s.updated_at, w.updated_at), 'YYYY-MM-DD') as updated_at
      FROM wiki.sections s
      JOIN wiki.wikis w ON s.wiki_id = w.id
      WHERE s.deleted_at IS NULL
        AND w.deleted_at IS NULL
        AND w.archived_at IS NULL
        -- Wiki must be public
        AND EXISTS (
          SELECT 1 FROM wiki.access_rules ar
          WHERE ar.ruleable_type = 'wiki'
            AND ar.ruleable_id = w.id
            AND ar.rule_type = 'public'
        )
        -- Section must not have restrictive override
        AND NOT EXISTS (
          SELECT 1 FROM wiki.access_rules ar
          WHERE ar.ruleable_type = 'section'
            AND ar.ruleable_id = s.id
            AND ar.rule_type != 'public'
        )
      ORDER BY s.updated_at DESC
    `;

    const result = await this.pool.query(query);
    return result.rows;
  }

  /**
   * Fetch public published pages
   */
  private async getPublicPages(): Promise<Array<{ slug: string; section_slug: string; wiki_slug: string; updated_at: string }>> {
    const query = `
      SELECT
        p.slug,
        s.slug as section_slug,
        w.slug as wiki_slug,
        TO_CHAR(GREATEST(p.updated_at, s.updated_at, w.updated_at), 'YYYY-MM-DD') as updated_at
      FROM wiki.pages p
      JOIN wiki.sections s ON p.section_id = s.id
      JOIN wiki.wikis w ON s.wiki_id = w.id
      WHERE p.deleted_at IS NULL
        AND s.deleted_at IS NULL
        AND w.deleted_at IS NULL
        AND w.archived_at IS NULL
        AND p.status = 'published'
        -- Wiki must be public
        AND EXISTS (
          SELECT 1 FROM wiki.access_rules ar
          WHERE ar.ruleable_type = 'wiki'
            AND ar.ruleable_id = w.id
            AND ar.rule_type = 'public'
        )
        -- Section must not have restrictive override
        AND NOT EXISTS (
          SELECT 1 FROM wiki.access_rules ar
          WHERE ar.ruleable_type = 'section'
            AND ar.ruleable_id = s.id
            AND ar.rule_type != 'public'
        )
        -- Page must not have restrictive override
        AND NOT EXISTS (
          SELECT 1 FROM wiki.access_rules ar
          WHERE ar.ruleable_type = 'page'
            AND ar.ruleable_id = p.id
            AND ar.rule_type != 'public'
        )
      ORDER BY p.updated_at DESC
    `;

    const result = await this.pool.query(query);
    return result.rows;
  }

  /**
   * Build sitemap XML from entries
   */
  private buildSitemapXml(entries: SitemapEntry[]): string {
    const urlElements = entries.map(entry => `  <url>
    <loc>${this.escapeXml(entry.loc)}</loc>
    <lastmod>${entry.lastmod}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlElements}
</urlset>`;
  }

  /**
   * Escape special characters for XML
   */
  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Clear the sitemap cache (useful after content updates)
   */
  clearCache(): void {
    this.sitemapCache = null;
    this.sitemapCacheTime = 0;
  }
}
