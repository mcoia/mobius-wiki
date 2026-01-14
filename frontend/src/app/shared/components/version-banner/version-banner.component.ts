import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-version-banner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './version-banner.component.html',
  styleUrls: ['./version-banner.component.css']
})
export class VersionBannerComponent {
  @Input() status!: string;  // 'draft' or 'published'
  @Input() isViewingDraft!: boolean;
  @Input() hasDraft!: boolean;
  @Input() publishedVersionNumber?: number;
  @Input() currentVersionNumber?: number;
  @Input() publishedAt?: string | null;
  @Input() canEdit!: boolean;

  @Output() viewDraft = new EventEmitter<void>();
  @Output() viewPublished = new EventEmitter<void>();
  @Output() publish = new EventEmitter<void>();
  @Output() discardDraft = new EventEmitter<void>();
  @Output() edit = new EventEmitter<void>();
}
