import { Component, Input, Output, EventEmitter, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, FileText, Check, User, ChevronDown, History } from 'lucide-angular';
import { PageVersion } from '../../../core/models/wiki.model';

@Component({
  selector: 'app-version-banner',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './version-banner.component.html',
  styleUrls: ['./version-banner.component.css']
})
export class VersionBannerComponent {
  // Lucide icons
  readonly FileText = FileText;
  readonly Check = Check;
  readonly User = User;
  readonly ChevronDown = ChevronDown;
  readonly History = History;

  @Input() status!: string;  // 'draft' or 'published'
  @Input() isViewingDraft!: boolean;
  @Input() hasDraft!: boolean;
  @Input() publishedVersionNumber?: number;
  @Input() currentVersionNumber?: number;
  @Input() publishedAt?: string | null;
  @Input() canEdit!: boolean;

  // Author info
  @Input() authorName?: string;
  @Input() authorAvatarUrl?: string | null;
  @Input() updatedAt?: string;

  // Version history
  @Input() versions: PageVersion[] = [];
  @Input() viewingVersionNumber?: number | null;  // null means viewing current

  @Output() viewDraft = new EventEmitter<void>();
  @Output() viewPublished = new EventEmitter<void>();
  @Output() publish = new EventEmitter<void>();
  @Output() discardDraft = new EventEmitter<void>();
  @Output() edit = new EventEmitter<void>();
  @Output() selectVersion = new EventEmitter<number>();
  @Output() restoreVersion = new EventEmitter<number>();

  // Dropdown state
  showVersionDropdown = false;

  /**
   * Check if viewing a historical version (not current draft/published)
   */
  get isViewingHistorical(): boolean {
    if (this.viewingVersionNumber === null || this.viewingVersionNumber === undefined) {
      return false;
    }
    return this.viewingVersionNumber !== this.currentVersionNumber;
  }

  /**
   * Get the currently viewed version for display
   */
  get currentlyViewedVersion(): PageVersion | undefined {
    if (this.viewingVersionNumber !== null && this.viewingVersionNumber !== undefined) {
      return this.versions.find(v => v.version_number === this.viewingVersionNumber);
    }
    // Return the current (latest) version
    return this.versions.find(v => v.version_number === this.currentVersionNumber);
  }

  /**
   * Get label for a version (e.g., "v3 - Draft (current)")
   */
  getVersionLabel(version: PageVersion): string {
    const parts: string[] = [`v${version.version_number}`];

    // Add status badges
    if (version.version_number === this.currentVersionNumber) {
      if (this.isDraftStatus()) {
        parts.push('Draft');
      }
      parts.push('(current)');
    } else if (version.version_number === this.publishedVersionNumber) {
      parts.push('Published');
    }

    return parts.join(' - ');
  }

  /**
   * Check if page status is draft (helper to avoid TypeScript narrowing issues in template)
   */
  isDraftStatus(): boolean {
    return this.status === 'draft';
  }

  /**
   * Get the dropdown button text
   */
  get dropdownButtonText(): string {
    if (this.isViewingHistorical) {
      const version = this.currentlyViewedVersion;
      return version ? `v${version.version_number}` : 'Version';
    }

    if (this.isViewingDraft) {
      return `v${this.currentVersionNumber} (draft)`;
    }

    return `v${this.publishedVersionNumber || this.currentVersionNumber}`;
  }

  toggleVersionDropdown(): void {
    this.showVersionDropdown = !this.showVersionDropdown;
  }

  onSelectVersion(versionNumber: number): void {
    this.showVersionDropdown = false;
    this.selectVersion.emit(versionNumber);
  }

  onRestoreVersion(): void {
    if (this.viewingVersionNumber !== null && this.viewingVersionNumber !== undefined) {
      this.restoreVersion.emit(this.viewingVersionNumber);
    }
  }

  /**
   * Close dropdown when clicking outside
   */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.showVersionDropdown) return;

    const target = event.target as HTMLElement;
    if (!target.closest('.version-dropdown-container')) {
      this.showVersionDropdown = false;
    }
  }

  /**
   * Get initials from author name for avatar fallback
   */
  getInitials(name?: string): string {
    if (!name) return '?';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }
}
