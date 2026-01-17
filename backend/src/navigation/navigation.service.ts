import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { AccessControlService } from '../access-control/access-control.service';

interface User {
  id: number;
  role?: string;
  libraryId?: number | null;
}

export interface NavPage {
  id: number;
  title: string;
  slug: string;
  status: string;
}

export interface NavSection {
  id: number;
  title: string;
  slug: string;
  pages: NavPage[];
}

export interface NavWiki {
  id: number;
  title: string;
  slug: string;
  sections: NavSection[];
}

export interface NavTree {
  wikis: NavWiki[];
}

@Injectable()
export class NavigationService {
  constructor(
    @Inject('DATABASE_POOL') private pool: Pool,
    private aclService: AccessControlService,
  ) {}

  async getNavigationTree(user: User | null = null): Promise<{ data: NavTree }> {
    // Fetch all wikis, sections, and pages in a single query
    const { rows } = await this.pool.query(`
      SELECT
        w.id as wiki_id, w.title as wiki_title, w.slug as wiki_slug, w.sort_order as wiki_sort,
        s.id as section_id, s.title as section_title, s.slug as section_slug, s.sort_order as section_sort,
        p.id as page_id, p.title as page_title, p.slug as page_slug, p.status as page_status, p.sort_order as page_sort
      FROM wiki.wikis w
      LEFT JOIN wiki.sections s ON s.wiki_id = w.id AND s.deleted_at IS NULL
      LEFT JOIN wiki.pages p ON p.section_id = s.id AND p.deleted_at IS NULL
      WHERE w.deleted_at IS NULL AND w.archived_at IS NULL
      ORDER BY w.sort_order, w.title, s.sort_order, s.title, p.sort_order, p.title
    `);

    // Build the tree structure with ACL filtering
    const wikiMap = new Map<number, NavWiki>();
    const sectionMap = new Map<number, NavSection>();

    for (const row of rows) {
      // Check wiki access
      if (!wikiMap.has(row.wiki_id)) {
        const canAccessWiki = await this.aclService.canAccess(user, 'wiki', row.wiki_id);
        if (canAccessWiki) {
          wikiMap.set(row.wiki_id, {
            id: row.wiki_id,
            title: row.wiki_title,
            slug: row.wiki_slug,
            sections: [],
          });
        }
      }

      // Skip if wiki not accessible
      if (!wikiMap.has(row.wiki_id)) {
        continue;
      }

      // Add section if present
      if (row.section_id && !sectionMap.has(row.section_id)) {
        const canAccessSection = await this.aclService.canAccess(user, 'section', row.section_id);
        if (canAccessSection) {
          const section: NavSection = {
            id: row.section_id,
            title: row.section_title,
            slug: row.section_slug,
            pages: [],
          };
          sectionMap.set(row.section_id, section);
          wikiMap.get(row.wiki_id)!.sections.push(section);
        }
      }

      // Add page if present
      if (row.page_id && sectionMap.has(row.section_id)) {
        const canAccessPage = await this.aclService.canAccess(user, 'page', row.page_id);
        if (canAccessPage) {
          sectionMap.get(row.section_id)!.pages.push({
            id: row.page_id,
            title: row.page_title,
            slug: row.page_slug,
            status: row.page_status,
          });
        }
      }
    }

    return {
      data: {
        wikis: Array.from(wikiMap.values()),
      },
    };
  }
}
