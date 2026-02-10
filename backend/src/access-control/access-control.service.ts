import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { hasRoleAccess } from './constants/roles.constant';

interface User {
  id?: number;
  role?: string;
  libraryId?: number | null;
}

interface AccessRule {
  id: number;
  ruleable_type: string;
  ruleable_id: number;
  rule_type: string;
  rule_value: string | null;
}

interface PageHierarchy {
  page_id: number;
  section_id: number;
  wiki_id: number;
}

@Injectable()
export class AccessControlService {
  constructor(@Inject('DATABASE_POOL') private pool: Pool) {}

  /**
   * Main access check method
   * Implements inheritance: page → section → wiki → public
   * For files: most restrictive wins (file ACL AND linked content ACL)
   */
  async canAccess(
    user: User | null,
    contentType: string,
    contentId: number,
  ): Promise<boolean> {
    // Special handling for files: most restrictive wins
    if (contentType === 'file') {
      return this.canAccessFile(user, contentId);
    }

    // Get rules for this content
    const rules = await this.getRules(contentType, contentId);

    // If no rules, check parent (inheritance)
    if (rules.length === 0) {
      const parent = await this.getParent(contentType, contentId);

      if (parent) {
        return this.canAccess(user, parent.type, parent.id);
      }

      // No rules anywhere in chain = public
      return true;
    }

    // Check rules (OR logic - matching ANY rule grants access)
    for (const rule of rules) {
      if (this.matchesRule(rule, user)) {
        return true;
      }
    }

    // No rule matched = denied
    return false;
  }

  /**
   * Check if user can EDIT content (modify/publish/delete)
   * Edit permission requires:
   * 1. User is authenticated
   * 2. User has staff-level role (library_staff or higher)
   * 3. User has READ access to the content (via canAccess)
   */
  async canEdit(
    user: User | null,
    contentType: string,
    contentId: number,
  ): Promise<boolean> {
    // Must be authenticated
    if (!user || !user.id) {
      return false;
    }

    const ROLE_LEVELS = { guest: 0, library_staff: 1, mobius_staff: 2, site_admin: 3 };

    // Must have staff-level role
    const roleLevel = ROLE_LEVELS[user.role] || 0;
    if (roleLevel < ROLE_LEVELS.library_staff) {
      return false;
    }

    // Must have read access (handles ACL rules)
    const hasReadAccess = await this.canAccess(user, contentType, contentId);
    if (!hasReadAccess) {
      return false;
    }

    // If user can read and has staff role, they can edit
    // (No more library boundary check)
    return true;
  }

  /**
   * Batch access check for multiple pages
   * Reduces N+1 queries to 2-3 queries total
   * Returns Map<pageId, canAccess>
   */
  async canAccessBatch(
    user: User | null,
    _contentType: 'page',
    contentIds: number[],
  ): Promise<Map<number, boolean>> {
    const result = new Map<number, boolean>();

    if (contentIds.length === 0) {
      return result;
    }

    // Step 1: Batch load page hierarchy (page → section → wiki)
    const hierarchyMap = await this.batchGetPageHierarchy(contentIds);

    // Collect all section and wiki IDs
    const sectionIds = new Set<number>();
    const wikiIds = new Set<number>();
    for (const hierarchy of hierarchyMap.values()) {
      sectionIds.add(hierarchy.section_id);
      wikiIds.add(hierarchy.wiki_id);
    }

    // Step 2: Batch load all access rules for pages, sections, and wikis
    const rulesMap = await this.batchGetRules(
      contentIds,
      Array.from(sectionIds),
      Array.from(wikiIds),
    );

    // Step 3: Process ACL in memory for each page
    for (const pageId of contentIds) {
      const hierarchy = hierarchyMap.get(pageId);
      if (!hierarchy) {
        // Page not found in hierarchy (maybe deleted), deny access
        result.set(pageId, false);
        continue;
      }

      const canAccess = this.evaluateAccessInMemory(
        user,
        pageId,
        hierarchy,
        rulesMap,
      );
      result.set(pageId, canAccess);
    }

    return result;
  }

  /**
   * Batch load page → section → wiki hierarchy
   */
  private async batchGetPageHierarchy(
    pageIds: number[],
  ): Promise<Map<number, PageHierarchy>> {
    const { rows } = await this.pool.query<PageHierarchy>(
      `SELECT
        p.id as page_id,
        p.section_id,
        s.wiki_id
       FROM wiki.pages p
       JOIN wiki.sections s ON p.section_id = s.id
       WHERE p.id = ANY($1) AND p.deleted_at IS NULL AND s.deleted_at IS NULL`,
      [pageIds],
    );

    const map = new Map<number, PageHierarchy>();
    for (const row of rows) {
      map.set(row.page_id, row);
    }
    return map;
  }

  /**
   * Batch load access rules for pages, sections, and wikis
   * Returns Map keyed by "type:id" (e.g., "page:123")
   */
  private async batchGetRules(
    pageIds: number[],
    sectionIds: number[],
    wikiIds: number[],
  ): Promise<Map<string, AccessRule[]>> {
    const { rows } = await this.pool.query<AccessRule>(
      `SELECT id, ruleable_type, ruleable_id, rule_type, rule_value
       FROM wiki.access_rules
       WHERE (ruleable_type = 'page' AND ruleable_id = ANY($1))
          OR (ruleable_type = 'section' AND ruleable_id = ANY($2))
          OR (ruleable_type = 'wiki' AND ruleable_id = ANY($3))`,
      [pageIds, sectionIds, wikiIds],
    );

    const map = new Map<string, AccessRule[]>();
    for (const row of rows) {
      const key = `${row.ruleable_type}:${row.ruleable_id}`;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(row);
    }
    return map;
  }

  /**
   * Evaluate access in memory using pre-loaded rules
   * Implements inheritance: page → section → wiki → public
   */
  private evaluateAccessInMemory(
    user: User | null,
    pageId: number,
    hierarchy: PageHierarchy,
    rulesMap: Map<string, AccessRule[]>,
  ): boolean {
    // Check page rules first
    const pageRules = rulesMap.get(`page:${pageId}`) || [];
    if (pageRules.length > 0) {
      return this.matchesAnyRule(pageRules, user);
    }

    // No page rules, check section (inheritance)
    const sectionRules = rulesMap.get(`section:${hierarchy.section_id}`) || [];
    if (sectionRules.length > 0) {
      return this.matchesAnyRule(sectionRules, user);
    }

    // No section rules, check wiki (inheritance)
    const wikiRules = rulesMap.get(`wiki:${hierarchy.wiki_id}`) || [];
    if (wikiRules.length > 0) {
      return this.matchesAnyRule(wikiRules, user);
    }

    // No rules anywhere in chain = public
    return true;
  }

  /**
   * Check if any rule in the array matches the user (OR logic)
   */
  private matchesAnyRule(rules: AccessRule[], user: User | null): boolean {
    for (const rule of rules) {
      if (this.matchesRule(rule, user)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Batch access check for multiple files
   * Reduces ~5,900 queries to 4 queries for 844 files
   * Returns Map<fileId, canAccess>
   */
  async canAccessFileBatch(
    user: User | null,
    fileIds: number[],
  ): Promise<Map<number, boolean>> {
    const result = new Map<number, boolean>();
    if (fileIds.length === 0) return result;

    // Query 1: Get all file rules
    const { rows: fileRules } = await this.pool.query<AccessRule>(
      `SELECT id, ruleable_type, ruleable_id, rule_type, rule_value
       FROM wiki.access_rules
       WHERE ruleable_type = 'file' AND ruleable_id = ANY($1)`,
      [fileIds],
    );

    // Query 2: Get all file links with page hierarchy
    const { rows: fileLinks } = await this.pool.query<{
      file_id: number;
      linkable_type: string;
      linkable_id: number;
      section_id: number | null;
      wiki_id: number | null;
    }>(
      `SELECT
         fl.file_id,
         fl.linkable_type,
         fl.linkable_id,
         p.section_id,
         COALESCE(s.wiki_id, s2.wiki_id, w.id) as wiki_id
       FROM wiki.file_links fl
       LEFT JOIN wiki.pages p ON fl.linkable_type = 'page' AND fl.linkable_id = p.id
       LEFT JOIN wiki.sections s ON p.section_id = s.id
       LEFT JOIN wiki.sections s2 ON fl.linkable_type = 'section' AND fl.linkable_id = s2.id
       LEFT JOIN wiki.wikis w ON fl.linkable_type = 'wiki' AND fl.linkable_id = w.id
       WHERE fl.file_id = ANY($1)`,
      [fileIds],
    );

    // Collect all content IDs for rule lookup
    const pageIds = new Set<number>();
    const sectionIds = new Set<number>();
    const wikiIds = new Set<number>();

    for (const link of fileLinks) {
      if (link.linkable_type === 'page') pageIds.add(link.linkable_id);
      if (link.linkable_type === 'section') sectionIds.add(link.linkable_id);
      if (link.linkable_type === 'wiki') wikiIds.add(link.linkable_id);
      if (link.section_id) sectionIds.add(link.section_id);
      if (link.wiki_id) wikiIds.add(link.wiki_id);
    }

    // Query 3: Get all content rules in one query
    const { rows: contentRules } = await this.pool.query<AccessRule>(
      `SELECT id, ruleable_type, ruleable_id, rule_type, rule_value
       FROM wiki.access_rules
       WHERE (ruleable_type = 'page' AND ruleable_id = ANY($1))
          OR (ruleable_type = 'section' AND ruleable_id = ANY($2))
          OR (ruleable_type = 'wiki' AND ruleable_id = ANY($3))`,
      [Array.from(pageIds), Array.from(sectionIds), Array.from(wikiIds)],
    );

    // Index rules by type:id for O(1) lookup
    const rulesMap = new Map<string, AccessRule[]>();
    for (const rule of [...fileRules, ...contentRules]) {
      const key = `${rule.ruleable_type}:${rule.ruleable_id}`;
      if (!rulesMap.has(key)) rulesMap.set(key, []);
      rulesMap.get(key)!.push(rule);
    }

    // Index file links by file_id
    const linksMap = new Map<number, typeof fileLinks>();
    for (const link of fileLinks) {
      if (!linksMap.has(link.file_id)) linksMap.set(link.file_id, []);
      linksMap.get(link.file_id)!.push(link);
    }

    // Process each file in memory
    for (const fileId of fileIds) {
      const canAccess = this.evaluateFileAccessInMemory(
        user,
        fileId,
        rulesMap,
        linksMap.get(fileId) || [],
      );
      result.set(fileId, canAccess);
    }

    return result;
  }

  /**
   * Evaluate file access in memory using pre-loaded rules
   * File ACL AND at least one linked content must be accessible
   */
  private evaluateFileAccessInMemory(
    user: User | null,
    fileId: number,
    rulesMap: Map<string, AccessRule[]>,
    links: Array<{
      file_id: number;
      linkable_type: string;
      linkable_id: number;
      section_id: number | null;
      wiki_id: number | null;
    }>,
  ): boolean {
    // Check file's own rules
    const fileRules = rulesMap.get(`file:${fileId}`) || [];
    let fileAccessGranted = fileRules.length === 0; // No rules = public

    if (!fileAccessGranted) {
      fileAccessGranted = this.matchesAnyRule(fileRules, user);
    }

    if (!fileAccessGranted) return false;
    if (links.length === 0) return true; // No links = file ACL only

    // Check if user can access at least ONE linked content
    for (const link of links) {
      if (this.evaluateContentAccessInMemory(user, link, rulesMap)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Evaluate content access in memory
   * Walks inheritance chain: page → section → wiki → public
   */
  private evaluateContentAccessInMemory(
    user: User | null,
    link: {
      linkable_type: string;
      linkable_id: number;
      section_id: number | null;
      wiki_id: number | null;
    },
    rulesMap: Map<string, AccessRule[]>,
  ): boolean {
    // Build check levels based on content type
    const checkLevels: string[] = [];

    if (link.linkable_type === 'page') {
      checkLevels.push(`page:${link.linkable_id}`);
      if (link.section_id) checkLevels.push(`section:${link.section_id}`);
      if (link.wiki_id) checkLevels.push(`wiki:${link.wiki_id}`);
    } else if (link.linkable_type === 'section') {
      checkLevels.push(`section:${link.linkable_id}`);
      if (link.wiki_id) checkLevels.push(`wiki:${link.wiki_id}`);
    } else if (link.linkable_type === 'wiki') {
      checkLevels.push(`wiki:${link.linkable_id}`);
    }

    // Walk inheritance chain
    for (const key of checkLevels) {
      const rules = rulesMap.get(key) || [];
      if (rules.length > 0) {
        // Has rules at this level - check if any match
        return this.matchesAnyRule(rules, user);
      }
      // No rules at this level - continue to parent
    }

    // No rules anywhere = public
    return true;
  }

  /**
   * File access control: most restrictive wins
   * User must have access to BOTH file AND at least one linked content
   */
  private async canAccessFile(
    user: User | null,
    fileId: number,
  ): Promise<boolean> {
    // First check file's own ACL
    const fileRules = await this.getRules('file', fileId);

    // If file has no rules, file itself is public (pass)
    let fileAccessGranted = false;
    if (fileRules.length === 0) {
      fileAccessGranted = true;
    } else {
      // Check if any file rule matches
      for (const rule of fileRules) {
        if (this.matchesRule(rule, user)) {
          fileAccessGranted = true;
          break;
        }
      }
    }

    // If file access denied, no need to check linked content
    if (!fileAccessGranted) {
      return false;
    }

    // Get all linked content
    const { rows: links } = await this.pool.query(
      `SELECT linkable_type, linkable_id FROM wiki.file_links WHERE file_id = $1`,
      [fileId]
    );

    // If no links, file access is based on file ACL only
    if (links.length === 0) {
      return fileAccessGranted;
    }

    // Check if user can access at least ONE linked content
    for (const link of links) {
      const linkedAccessGranted = await this.canAccess(
        user,
        link.linkable_type,
        link.linkable_id
      );

      if (linkedAccessGranted) {
        // User can access both file AND this linked content
        return true;
      }
    }

    // User cannot access any linked content
    return false;
  }

  /**
   * Get access rules for content
   */
  private async getRules(ruleableType: string, ruleableId: number): Promise<AccessRule[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM wiki.access_rules
       WHERE ruleable_type = $1 AND ruleable_id = $2`,
      [ruleableType, ruleableId]
    );

    return rows;
  }

  /**
   * Get parent in content hierarchy for inheritance
   */
  private async getParent(contentType: string, contentId: number): Promise<{type: string, id: number} | null> {
    if (contentType === 'page') {
      // Page → Section
      const { rows } = await this.pool.query(
        `SELECT section_id FROM wiki.pages WHERE id = $1 AND deleted_at IS NULL`,
        [contentId]
      );

      if (rows.length > 0 && rows[0].section_id) {
        return { type: 'section', id: rows[0].section_id };
      }
    }

    if (contentType === 'section') {
      // Section → Wiki
      const { rows } = await this.pool.query(
        `SELECT wiki_id FROM wiki.sections WHERE id = $1 AND deleted_at IS NULL`,
        [contentId]
      );

      if (rows.length > 0 && rows[0].wiki_id) {
        return { type: 'wiki', id: rows[0].wiki_id };
      }
    }

    // Wiki and File have no parent
    return null;
  }

  /**
   * Check if a single rule matches the user
   */
  private matchesRule(rule: AccessRule, user: User | null): boolean {
    switch (rule.rule_type) {
      case 'public':
        return true;

      case 'role':
        if (!user || !user.role) return false;
        return hasRoleAccess(user.role, rule.rule_value);

      case 'user':
        if (!user || !user.id) return false;
        return user.id.toString() === rule.rule_value;

      default:
        return false;
    }
  }
}
