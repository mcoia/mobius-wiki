import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, FileText, Check, User } from 'lucide-angular';

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

  @Input() status!: string;  // 'draft' or 'published'
  @Input() isViewingDraft!: boolean;
  @Input() hasDraft!: boolean;
  @Input() publishedVersionNumber?: number;
  @Input() currentVersionNumber?: number;
  @Input() publishedAt?: string | null;
  @Input() canEdit!: boolean;

  // Author info
  @Input() authorName?: string;
  @Input() updatedAt?: string;

  @Output() viewDraft = new EventEmitter<void>();
  @Output() viewPublished = new EventEmitter<void>();
  @Output() publish = new EventEmitter<void>();
  @Output() discardDraft = new EventEmitter<void>();
  @Output() edit = new EventEmitter<void>();
}
