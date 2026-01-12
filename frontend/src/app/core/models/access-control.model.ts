/**
 * Access Control Models
 *
 * TypeScript interfaces for the access control system.
 * Backend supports 5 rule types: public, role, library, user, link
 * Frontend exposes 3: public, role, link
 */

export interface AccessRule {
  id: number;
  ruleable_type: string;
  ruleable_id: number;
  rule_type: 'public' | 'role' | 'link' | 'library' | 'user';
  rule_value: string | null;
  expires_at: string | null;
  created_at: string;
  created_by: number;
}

export interface ShareLinkResponse {
  token: string;
  shareUrl: string;
  rule: AccessRule;
}

export interface CreateAccessRuleDto {
  ruleType: 'public' | 'role' | 'link';
  ruleValue?: string;
  expiresAt?: string;
}

/**
 * Role types supported by the system
 */
export type RoleType = 'library_staff' | 'mobius_staff' | 'site_admin';

/**
 * Helper interface for displaying access rules in UI
 */
export interface AccessRuleDisplay extends AccessRule {
  displayTitle: string;
  displayDescription: string;
  icon: string;
}
