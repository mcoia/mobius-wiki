import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import {
  AccessRule,
  ShareLinkResponse,
  CreateAccessRuleDto
} from '../models/access-control.model';

/**
 * Access Control Service
 *
 * Handles all API interactions for managing access control rules.
 * Supports three rule types: public, role, and share links.
 *
 * Backend API Endpoints:
 * - GET    /:type/:id/access-rules       (list rules)
 * - POST   /:type/:id/access-rules       (create rule)
 * - DELETE /access-rules/:ruleId         (delete rule)
 * - POST   /:type/:id/share-link         (generate share token)
 */
@Injectable({
  providedIn: 'root'
})
export class AccessControlService {
  constructor(private api: ApiService) {}

  /**
   * Get all access rules for a resource
   * @param type Resource type ('pages', 'sections', 'wikis', 'files')
   * @param id Resource ID
   * @returns Observable of access rules
   */
  getRules(type: string, id: number): Observable<{ data: AccessRule[] }> {
    return this.api.get(`/${type}/${id}/access-rules`);
  }

  /**
   * Create a new access rule
   * @param type Resource type ('pages', 'sections', 'wikis', 'files')
   * @param id Resource ID
   * @param ruleType Type of rule ('public', 'role', 'link')
   * @param ruleValue Optional value (role name for 'role' type)
   * @param expiresAt Optional expiration date (ISO 8601 string)
   * @returns Observable of created access rule
   */
  createRule(
    type: string,
    id: number,
    ruleType: 'public' | 'role' | 'link',
    ruleValue?: string,
    expiresAt?: string
  ): Observable<{ data: AccessRule }> {
    const dto: CreateAccessRuleDto = { ruleType };

    if (ruleValue) {
      dto.ruleValue = ruleValue;
    }

    if (expiresAt) {
      dto.expiresAt = expiresAt;
    }

    return this.api.post(`/${type}/${id}/access-rules`, dto);
  }

  /**
   * Delete an access rule
   * @param ruleId ID of the rule to delete
   * @returns Observable of deleted access rule
   */
  deleteRule(ruleId: number): Observable<{ data: AccessRule }> {
    return this.api.delete(`/access-rules/${ruleId}`);
  }

  /**
   * Generate a shareable link for a resource
   * @param type Resource type ('pages', 'sections', 'wikis', 'files')
   * @param id Resource ID
   * @param expiresAt Optional expiration date (ISO 8601 string)
   * @returns Observable of share link with token and URL
   */
  generateShareLink(
    type: string,
    id: number,
    expiresAt?: string
  ): Observable<{ data: ShareLinkResponse }> {
    const body: { expiresAt?: string } = {};

    if (expiresAt) {
      body.expiresAt = expiresAt;
    }

    return this.api.post(`/${type}/${id}/share-link`, body);
  }

  /**
   * Helper: Create a public access rule
   */
  makePublic(type: string, id: number): Observable<{ data: AccessRule }> {
    return this.createRule(type, id, 'public');
  }

  /**
   * Helper: Create a role-based access rule
   */
  restrictToRole(
    type: string,
    id: number,
    role: 'library_staff' | 'mobius_staff' | 'site_admin'
  ): Observable<{ data: AccessRule }> {
    return this.createRule(type, id, 'role', role);
  }
}
