import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, of } from 'rxjs';
import { map, catchError, shareReplay } from 'rxjs/operators';
import { LucideAngularModule, Lock, Globe, Users, Link2, Info, AlertTriangle, CheckCircle, X } from 'lucide-angular';
import { AccessControlService } from '../../../core/services/access-control.service';
import { AccessRule, RoleType } from '../../../core/models/access-control.model';

/**
 * Access Control Panel Component
 *
 * Displays and manages access rules for pages, sections, wikis, or files.
 * Shows current rules, inheritance status, and provides UI for adding/deleting rules.
 *
 * @Input contentType - Type of content ('pages', 'sections', 'wikis', 'files')
 * @Input contentId - ID of the content
 * @Input canManage - Whether current user can manage permissions
 * @Output rulesChanged - Emitted when rules are added/deleted
 */
@Component({
  selector: 'app-access-control-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './access-control-panel.component.html',
  styleUrls: ['./access-control-panel.component.css']
})
export class AccessControlPanelComponent implements OnInit {
  @Input() contentType: 'pages' | 'sections' | 'wikis' | 'files' = 'pages';
  @Input() contentId!: number;
  @Input() canManage = false;
  @Output() rulesChanged = new EventEmitter<void>();
  @Output() close = new EventEmitter<void>();

  // Lucide icon references for template
  readonly Lock = Lock;
  readonly Globe = Globe;
  readonly Users = Users;
  readonly Link2 = Link2;
  readonly Info = Info;
  readonly AlertTriangle = AlertTriangle;
  readonly CheckCircle = CheckCircle;
  readonly X = X;

  rules$!: Observable<AccessRule[]>;
  loading = false;
  error: string | null = null;

  // Modal states
  showAddRuleModal = false;
  showRoleModal = false;
  showShareLinkModal = false;
  showShareLinkResult = false;

  // Share link data
  generatedShareLink: string | null = null;
  shareExpiresAt: string | null = null;

  // Role selection
  selectedRole: RoleType | null = null;

  // Share link expiration settings
  linkNeverExpires = true;
  linkExpirationHours = 24;

  constructor(private accessControlService: AccessControlService) {}

  ngOnInit(): void {
    this.loadRules();
  }

  /**
   * Load access rules for the content
   */
  loadRules(): void {
    this.rules$ = this.accessControlService.getRules(this.contentType, this.contentId).pipe(
      map(response => response.data),
      catchError(error => {
        console.error('Failed to load access rules:', error);
        this.error = 'Failed to load access rules';
        return of([]);
      }),
      shareReplay(1)
    );
  }

  /**
   * Open the "Add Permission Rule" modal
   */
  openAddRuleModal(): void {
    this.showAddRuleModal = true;
    this.error = null;
  }

  /**
   * Close all modals
   */
  closeAllModals(): void {
    this.showAddRuleModal = false;
    this.showRoleModal = false;
    this.showShareLinkModal = false;
    this.showShareLinkResult = false;
    this.error = null;

    // Emit close event to parent component
    this.close.emit();
  }

  /**
   * User selected "Make Public" option
   */
  selectMakePublic(): void {
    this.loading = true;
    this.error = null;

    this.accessControlService.makePublic(this.contentType, this.contentId)
      .subscribe({
        next: () => {
          this.loading = false;
          this.closeAllModals();
          this.loadRules();
          this.rulesChanged.emit();
        },
        error: (error) => {
          this.loading = false;
          this.error = error.error?.message || 'Failed to make content public';
        }
      });
  }

  /**
   * User selected "Restrict by Role" option
   */
  selectRestrictByRole(): void {
    this.showAddRuleModal = false;
    this.showRoleModal = true;
    this.selectedRole = 'library_staff'; // Default selection
  }

  /**
   * User selected "Generate Share Link" option
   */
  selectGenerateShareLink(): void {
    this.showAddRuleModal = false;
    this.showShareLinkModal = true;
    this.linkNeverExpires = true;
    this.linkExpirationHours = 24;
  }

  /**
   * Create role-based access rule
   */
  createRoleRule(): void {
    if (!this.selectedRole) {
      this.error = 'Please select a role';
      return;
    }

    this.loading = true;
    this.error = null;

    this.accessControlService.restrictToRole(this.contentType, this.contentId, this.selectedRole)
      .subscribe({
        next: () => {
          this.loading = false;
          this.closeAllModals();
          this.loadRules();
          this.rulesChanged.emit();
        },
        error: (error) => {
          this.loading = false;
          this.error = error.error?.message || 'Failed to create role rule';
        }
      });
  }

  /**
   * Generate share link with optional expiration
   */
  generateShareLink(): void {
    this.loading = true;
    this.error = null;

    let expiresAt: string | undefined;

    if (!this.linkNeverExpires) {
      const expirationDate = new Date();
      expirationDate.setHours(expirationDate.getHours() + this.linkExpirationHours);
      expiresAt = expirationDate.toISOString();
    }

    this.accessControlService.generateShareLink(this.contentType, this.contentId, expiresAt)
      .subscribe({
        next: (response) => {
          this.loading = false;
          this.generatedShareLink = `${window.location.origin}${response.data.shareUrl}`;
          this.shareExpiresAt = response.data.rule.expires_at;
          this.showShareLinkModal = false;
          this.showShareLinkResult = true;
          this.loadRules();
          this.rulesChanged.emit();
        },
        error: (error) => {
          this.loading = false;
          this.error = error.error?.message || 'Failed to generate share link';
        }
      });
  }

  /**
   * Copy share link to clipboard
   */
  copyShareLink(): void {
    if (!this.generatedShareLink) return;

    navigator.clipboard.writeText(this.generatedShareLink).then(
      () => {
        alert('Link copied to clipboard!');
      },
      (err) => {
        console.error('Failed to copy link:', err);
        alert('Failed to copy link. Please copy manually.');
      }
    );
  }

  /**
   * Delete an access rule
   */
  deleteRule(rule: AccessRule): void {
    const confirmed = confirm(`Are you sure you want to remove this access rule?`);
    if (!confirmed) return;

    this.loading = true;
    this.error = null;

    this.accessControlService.deleteRule(rule.id)
      .subscribe({
        next: () => {
          this.loading = false;
          this.loadRules();
          this.rulesChanged.emit();
        },
        error: (error) => {
          this.loading = false;
          this.error = error.error?.message || 'Failed to delete rule';
        }
      });
  }

  /**
   * Get display information for a rule
   */
  getRuleDisplay(rule: AccessRule): { icon: any; title: string; description: string } {
    switch (rule.rule_type) {
      case 'public':
        return {
          icon: this.Globe,
          title: 'Public Access',
          description: 'Anyone can view this content'
        };
      case 'role':
        return {
          icon: this.Users,
          title: `Role: ${this.formatRoleName(rule.rule_value)}`,
          description: `Only ${this.formatRoleName(rule.rule_value)} and above can view`
        };
      case 'link':
        return {
          icon: this.Link2,
          title: 'Share Link',
          description: rule.expires_at
            ? `Expires: ${new Date(rule.expires_at).toLocaleString()}`
            : 'Never expires'
        };
      default:
        return {
          icon: this.Lock,
          title: 'Custom Rule',
          description: rule.rule_type
        };
    }
  }

  /**
   * Format role name for display
   */
  formatRoleName(roleName: string | null): string {
    if (!roleName) return 'Unknown';

    const roleMap: Record<string, string> = {
      library_staff: 'Library Staff',
      mobius_staff: 'MOBIUS Staff',
      site_admin: 'Site Administrators'
    };

    return roleMap[roleName] || roleName;
  }

  /**
   * Get relative time string for rule creation
   */
  getRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  }

  /**
   * Get full share link URL for a rule
   */
  getShareLinkUrl(token: string): string {
    return `${window.location.origin}/${this.contentType}/${this.contentId}?token=${token}`;
  }

  /**
   * Format expiration date for display
   */
  formatExpirationDate(dateString: string | null): string {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  }
}
