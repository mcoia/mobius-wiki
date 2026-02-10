import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable, of } from 'rxjs';
import { map, catchError, shareReplay, switchMap } from 'rxjs/operators';
import {
  LucideAngularModule,
  Paperclip,
  Upload,
  Download,
  Trash2,
  FileText,
  Image,
  Archive,
  FileCode,
  File,
  X,
  ChevronDown,
  ChevronUp
} from 'lucide-angular';

import { FileService } from '../../../core/services/file.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { ToastService } from '../../../core/services/toast.service';
import { SettingsService, UploadLimitConfig } from '../../../core/services/settings.service';
import {
  FileAttachment,
  UploadProgress,
  formatFileSize,
  getFileCategory,
  validateFile
} from '../../../core/models/file.model';

/**
 * Attachments Panel Component
 *
 * Displays and manages file attachments for a page.
 * Supports drag-and-drop upload, file listing, download, and removal.
 *
 * @Input pageId - ID of the page
 * @Input canEdit - Whether current user can upload/remove files
 * @Output attachmentAdded - Emitted when a file is uploaded and linked
 * @Output attachmentRemoved - Emitted when a file is unlinked
 */
@Component({
  selector: 'app-attachments-panel',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './attachments-panel.component.html',
  styleUrls: ['./attachments-panel.component.css']
})
export class AttachmentsPanelComponent implements OnInit, OnChanges {
  @Input() pageId!: number;
  @Input() canEdit = false;
  @Output() attachmentAdded = new EventEmitter<FileAttachment>();
  @Output() attachmentRemoved = new EventEmitter<number>();

  // Lucide icon references for template
  readonly Paperclip = Paperclip;
  readonly Upload = Upload;
  readonly Download = Download;
  readonly Trash2 = Trash2;
  readonly FileText = FileText;
  readonly Image = Image;
  readonly Archive = Archive;
  readonly FileCode = FileCode;
  readonly File = File;
  readonly X = X;
  readonly ChevronDown = ChevronDown;
  readonly ChevronUp = ChevronUp;

  // State
  attachments$!: Observable<FileAttachment[]>;
  uploadLimit$!: Observable<UploadLimitConfig>;
  isCollapsed = false;
  isDragOver = false;
  uploadProgress: UploadProgress[] = [];
  error: string | null = null;

  constructor(
    private fileService: FileService,
    private confirmDialog: ConfirmDialogService,
    private toast: ToastService,
    private settingsService: SettingsService
  ) {}

  ngOnInit(): void {
    this.loadAttachments();
    this.uploadLimit$ = this.settingsService.getUploadLimit();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Reload when pageId changes
    if (changes['pageId'] && !changes['pageId'].firstChange) {
      this.loadAttachments();
    }
  }

  /**
   * Load attachments for the current page
   */
  loadAttachments(): void {
    if (!this.pageId) return;

    this.attachments$ = this.fileService.getLinkedFiles(this.pageId, 'attachment').pipe(
      map(response => response.data),
      catchError(error => {
        console.error('Failed to load attachments:', error);
        this.error = 'Failed to load attachments';
        return of([]);
      }),
      shareReplay(1)
    );
  }

  /**
   * Toggle collapsed state
   */
  toggleCollapsed(): void {
    this.isCollapsed = !this.isCollapsed;
  }

  // =====================
  // Drag and Drop
  // =====================

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.canEdit) {
      this.isDragOver = true;
    }
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;

    if (!this.canEdit) return;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.uploadFiles(Array.from(files));
    }
  }

  // =====================
  // File Input
  // =====================

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.uploadFiles(Array.from(input.files));
      input.value = ''; // Reset for re-upload of same file
    }
  }

  // =====================
  // Upload Logic
  // =====================

  uploadFiles(files: File[]): void {
    this.error = null;

    // Get upload limit from cached settings (default to 50 MB if not yet loaded)
    const uploadLimit = this.settingsService.currentUploadLimit;
    const maxSizeBytes = uploadLimit?.maxUploadSizeBytes ?? (50 * 1024 * 1024);

    for (const file of files) {
      // Validate file size against configured limit
      const validation = validateFile(file, maxSizeBytes);
      if (!validation.valid) {
        this.toast.error(validation.error!);
        continue;
      }

      // Add to progress tracking
      const progress: UploadProgress = {
        file,
        progress: 0,
        status: 'uploading'
      };
      this.uploadProgress.push(progress);

      // Upload then link to page
      this.fileService.uploadSimple(file).pipe(
        switchMap(response => {
          progress.status = 'linking';
          progress.progress = 90;
          return this.fileService.linkToPage(response.data.id, this.pageId).pipe(
            map(() => response.data)
          );
        })
      ).subscribe({
        next: (attachment) => {
          progress.status = 'complete';
          progress.progress = 100;
          progress.result = attachment;
          this.toast.success(`${file.name} uploaded`);
          this.loadAttachments();
          this.attachmentAdded.emit(attachment);

          // Remove from progress after delay
          setTimeout(() => {
            this.uploadProgress = this.uploadProgress.filter(p => p !== progress);
          }, 2000);
        },
        error: (error) => {
          progress.status = 'error';
          progress.error = error.error?.message || 'Upload failed';
          this.toast.error(`Failed to upload ${file.name}`);
        }
      });
    }
  }

  // =====================
  // File Actions
  // =====================

  /**
   * Download a file (opens in new tab)
   */
  downloadAttachment(attachment: FileAttachment): void {
    window.open(this.fileService.getDownloadUrl(attachment.id), '_blank');
  }

  /**
   * Remove attachment from page (unlink, doesn't delete file)
   */
  removeAttachment(attachment: FileAttachment): void {
    this.confirmDialog.open({
      title: 'Remove Attachment',
      message: `Remove "${attachment.filename}" from this page? The file will remain in the system but won't be linked to this page.`,
      type: 'warning',
      confirmText: 'Remove',
      cancelText: 'Cancel'
    }).subscribe(confirmed => {
      if (!confirmed) return;

      this.fileService.unlinkFromPage(attachment.id, this.pageId).subscribe({
        next: () => {
          this.toast.success('Attachment removed');
          this.loadAttachments();
          this.attachmentRemoved.emit(attachment.id);
        },
        error: (error) => {
          this.toast.error(error.error?.message || 'Failed to remove attachment');
        }
      });
    });
  }

  /**
   * Clear upload error from progress list
   */
  clearError(progress: UploadProgress): void {
    this.uploadProgress = this.uploadProgress.filter(p => p !== progress);
  }

  // =====================
  // Helpers
  // =====================

  /**
   * Get appropriate icon for file type
   */
  getFileIcon(mimeType: string): any {
    const category = getFileCategory(mimeType);
    switch (category) {
      case 'image': return this.Image;
      case 'document': return this.FileText;
      case 'archive': return this.Archive;
      case 'code': return this.FileCode;
      default: return this.File;
    }
  }

  /**
   * Format file size for display
   */
  formatSize(bytes: number): string {
    return formatFileSize(bytes);
  }
}
