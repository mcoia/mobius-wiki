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
  expires_at: Date | null;
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
    token?: string,
  ): Promise<boolean> {
    // Special handling for files: most restrictive wins
    if (contentType === 'file') {
      return this.canAccessFile(user, contentId, token);
    }

    // Get rules for this content
    const rules = await this.getRules(contentType, contentId);

    // If no rules, check parent (inheritance)
    if (rules.length === 0) {
      const parent = await this.getParent(contentType, contentId);

      if (parent) {
        return this.canAccess(user, parent.type, parent.id, token);
      }

      // No rules anywhere in chain = public
      return true;
    }

    // Check rules (OR logic - matching ANY rule grants access)
    for (const rule of rules) {
      if (this.matchesRule(rule, user, token)) {
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
   * 4. If library_staff, content must be in their library
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

    // mobius_staff or site_admin can edit anything they can read
    if (roleLevel >= ROLE_LEVELS.mobius_staff) {
      return true;
    }

    // For library_staff, check library boundary
    const wiki = await this.getWikiForContent(contentType, contentId);

    if (!wiki) {
      return false;
    }

    // library_staff can only edit content in their library's wiki
    return user.libraryId !== null && user.libraryId === wiki.library_id;
  }

  /**
   * Helper: Get the wiki for any content type
   * Used to check library boundaries for edit permissions
   */
  private async getWikiForContent(
    contentType: string,
    contentId: number
  ): Promise<{ id: number; library_id: number | null } | null> {
    if (contentType === 'wiki') {
      const { rows } = await this.pool.query(
        'SELECT id, library_id FROM wiki.wikis WHERE id = $1',
        [contentId]
      );
      return rows[0] || null;
    }

    if (contentType === 'section') {
      const { rows } = await this.pool.query(
        `SELECT w.id, w.library_id
         FROM wiki.wikis w
         JOIN wiki.sections s ON s.wiki_id = w.id
         WHERE s.id = $1`,
        [contentId]
      );
      return rows[0] || null;
    }

    if (contentType === 'page') {
      const { rows } = await this.pool.query(
        `SELECT w.id, w.library_id
         FROM wiki.wikis w
         JOIN wiki.sections s ON s.wiki_id = w.id
         JOIN wiki.pages p ON p.section_id = s.id
         WHERE p.id = $1`,
        [contentId]
      );
      return rows[0] || null;
    }

    return null;
  }

  /**
   * File access control: most restrictive wins
   * User must have access to BOTH file AND at least one linked content
   */
  private async canAccessFile(
    user: User | null,
    fileId: number,
    token?: string,
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
        if (this.matchesRule(rule, user, token)) {
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
        link.linkable_id,
        token
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
   * Check if a single rule matches the user/token
   */
  private matchesRule(rule: AccessRule, user: User | null, token?: string): boolean {
    switch (rule.rule_type) {
      case 'public':
        return true;

      case 'link':
        if (!token) return false;
        if (token !== rule.rule_value) return false;

        // Check expiration
        if (rule.expires_at) {
          const now = new Date();
          const expiresAt = new Date(rule.expires_at);
          if (expiresAt < now) return false;  // Expired
        }

        return true;

      case 'role':
        if (!user || !user.role) return false;
        return hasRoleAccess(user.role, rule.rule_value);

      case 'library':
        if (!user || user.libraryId === null || user.libraryId === undefined) return false;
        return user.libraryId.toString() === rule.rule_value;

      case 'user':
        if (!user || !user.id) return false;
        return user.id.toString() === rule.rule_value;

      default:
        return false;
    }
  }
}
