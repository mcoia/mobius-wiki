import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Observable, BehaviorSubject, of, combineLatest } from 'rxjs';
import { switchMap, catchError, shareReplay, map, tap } from 'rxjs/operators';
import { BaseChartDirective } from 'ng2-charts';
import { Chart, ChartConfiguration, ChartData, registerables } from 'chart.js';

import { FileService } from '../../../core/services/file.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  FileWithMeta,
  FileFilters,
  FileAdminQuery,
  FileAdminResponse,
  StorageStats,
  FileLinkInfo,
  FileAuditLog,
  formatFileSize,
  getFileCategory,
} from '../../../core/models/file.model';

// Register Chart.js components
Chart.register(...registerables);

interface FilterState extends FileFilters {
  page: number;
  limit: number;
  sortBy: 'filename' | 'size_bytes' | 'uploaded_at' | 'mime_type';
  sortOrder: 'asc' | 'desc';
}

@Component({
  selector: 'app-files',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, BaseChartDirective],
  templateUrl: './files.component.html',
  styleUrl: './files.component.css',
})
export class FilesComponent implements OnInit {
  // Observable streams
  files$!: Observable<FileWithMeta[]>;
  meta$!: Observable<{ total: number; page: number; limit: number; totalPages: number }>;
  stats$!: Observable<StorageStats | null>;

  // Chart data
  typeChartData$!: Observable<ChartData<'doughnut'> | null>;

  // Refresh triggers
  private refreshTrigger$ = new BehaviorSubject<void>(undefined);

  // Filter state
  filters: FilterState = {
    type: null,
    search: null,
    uploadedBy: null,
    dateFrom: null,
    dateTo: null,
    orphaned: false,
    includeDeleted: false,
    page: 1,
    limit: 25,
    sortBy: 'uploaded_at',
    sortOrder: 'desc',
  };

  // Search input (debounce separately)
  searchInput = '';

  // UI state
  loading = false;
  selectedFile: FileWithMeta | null = null;
  showDetailsModal = false;
  showReplaceModal = false;
  fileLinks: FileLinkInfo[] = [];
  auditLogs: FileAuditLog[] = [];
  loadingDetails = false;

  // Replace modal state
  replaceFile: File | null = null;
  replacing = false;

  // Edit description state
  editingDescription = false;
  descriptionInput = '';
  savingDescription = false;

  // Chart options
  doughnutChartOptions: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          padding: 12,
          usePointStyle: true,
        },
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const label = context.label || '';
            const value = context.parsed || 0;
            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            return `${label}: ${value} (${percentage}%)`;
          },
        },
      },
    },
  };

  constructor(
    private fileService: FileService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  private loadData(): void {
    // Combined file list observable
    const response$ = this.refreshTrigger$.pipe(
      tap(() => this.loading = true),
      switchMap(() => {
        const query: FileAdminQuery = {
          ...this.filters,
          search: this.filters.search || undefined,
          type: this.filters.type || undefined,
          uploadedBy: this.filters.uploadedBy || undefined,
          dateFrom: this.filters.dateFrom || undefined,
          dateTo: this.filters.dateTo || undefined,
        };
        return this.fileService.getFilesAdmin(query);
      }),
      tap(() => this.loading = false),
      catchError(error => {
        console.error('Failed to load files:', error);
        this.toastService.error('Failed to load files');
        this.loading = false;
        return of({ data: [], meta: { total: 0, page: 1, limit: 25, totalPages: 0 } } as FileAdminResponse);
      }),
      shareReplay(1)
    );

    this.files$ = response$.pipe(map(r => r.data));
    this.meta$ = response$.pipe(map(r => r.meta));

    // Storage stats
    this.stats$ = this.refreshTrigger$.pipe(
      switchMap(() => this.fileService.getStorageStats()),
      map(r => r.data),
      catchError(error => {
        console.error('Failed to load storage stats:', error);
        return of(null);
      }),
      shareReplay(1)
    );

    // Chart data from stats
    this.typeChartData$ = this.stats$.pipe(
      map(stats => {
        if (!stats || stats.byType.length === 0) return null;
        return {
          labels: stats.byType.map(t => this.getTypeLabel(t.type)),
          datasets: [{
            data: stats.byType.map(t => t.count),
            backgroundColor: [
              '#0891B2', // teal-600 - image
              '#6366F1', // indigo-500 - document
              '#F59E0B', // amber-500 - archive
              '#94A3B8', // slate-400 - other
            ],
            borderWidth: 0,
            hoverOffset: 4,
          }],
        };
      })
    );
  }

  // ==========================================================================
  // FILTER METHODS
  // ==========================================================================

  applySearch(): void {
    this.filters.search = this.searchInput.trim() || null;
    this.filters.page = 1;
    this.refresh();
  }

  setTypeFilter(type: string | null): void {
    this.filters.type = type as any;
    this.filters.page = 1;
    this.refresh();
  }

  toggleOrphaned(): void {
    this.filters.orphaned = !this.filters.orphaned;
    this.filters.page = 1;
    this.refresh();
  }

  toggleIncludeDeleted(): void {
    this.filters.includeDeleted = !this.filters.includeDeleted;
    this.filters.page = 1;
    this.refresh();
  }

  clearFilters(): void {
    this.filters = {
      type: null,
      search: null,
      uploadedBy: null,
      dateFrom: null,
      dateTo: null,
      orphaned: false,
      includeDeleted: false,
      page: 1,
      limit: 25,
      sortBy: 'uploaded_at',
      sortOrder: 'desc',
    };
    this.searchInput = '';
    this.refresh();
  }

  // ==========================================================================
  // SORTING METHODS
  // ==========================================================================

  sort(column: 'filename' | 'size_bytes' | 'uploaded_at' | 'mime_type'): void {
    if (this.filters.sortBy === column) {
      this.filters.sortOrder = this.filters.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      this.filters.sortBy = column;
      this.filters.sortOrder = 'desc';
    }
    this.refresh();
  }

  getSortIcon(column: string): string {
    if (this.filters.sortBy !== column) return 'fa-sort';
    return this.filters.sortOrder === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
  }

  // ==========================================================================
  // PAGINATION METHODS
  // ==========================================================================

  setPage(page: number): void {
    this.filters.page = page;
    this.refresh();
  }

  // ==========================================================================
  // FILE ACTIONS
  // ==========================================================================

  openDetailsModal(file: FileWithMeta): void {
    this.selectedFile = file;
    this.showDetailsModal = true;
    this.loadingDetails = true;
    this.descriptionInput = file.description || '';

    // Load file links and audit logs in parallel
    combineLatest([
      this.fileService.getFileLinks(file.id).pipe(catchError(() => of({ data: [] }))),
      this.fileService.getFileAuditLogs(file.id).pipe(catchError(() => of({ data: [] }))),
    ]).subscribe({
      next: ([linksRes, logsRes]) => {
        this.fileLinks = linksRes.data;
        this.auditLogs = logsRes.data;
        this.loadingDetails = false;
      },
      error: () => {
        this.loadingDetails = false;
      }
    });
  }

  closeDetailsModal(): void {
    this.showDetailsModal = false;
    this.selectedFile = null;
    this.fileLinks = [];
    this.auditLogs = [];
    this.editingDescription = false;
  }

  openReplaceModal(file: FileWithMeta): void {
    this.selectedFile = file;
    this.showReplaceModal = true;
    this.replaceFile = null;
  }

  closeReplaceModal(): void {
    this.showReplaceModal = false;
    this.selectedFile = null;
    this.replaceFile = null;
  }

  onReplaceFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.replaceFile = input.files[0];
    }
  }

  confirmReplace(): void {
    if (!this.selectedFile || !this.replaceFile) return;

    this.replacing = true;
    this.fileService.replaceFile(this.selectedFile.id, this.replaceFile).subscribe({
      next: () => {
        this.toastService.success('File replaced successfully');
        this.closeReplaceModal();
        this.refresh();
        this.replacing = false;
      },
      error: (err) => {
        this.toastService.error(err?.error?.message || 'Failed to replace file');
        this.replacing = false;
      }
    });
  }

  startEditDescription(): void {
    this.editingDescription = true;
    this.descriptionInput = this.selectedFile?.description || '';
  }

  cancelEditDescription(): void {
    this.editingDescription = false;
    this.descriptionInput = this.selectedFile?.description || '';
  }

  saveDescription(): void {
    if (!this.selectedFile) return;

    this.savingDescription = true;
    this.fileService.updateFile(this.selectedFile.id, { description: this.descriptionInput }).subscribe({
      next: (res) => {
        this.toastService.success('Description updated');
        this.selectedFile!.description = res.data.description;
        this.editingDescription = false;
        this.savingDescription = false;
      },
      error: (err) => {
        this.toastService.error(err?.error?.message || 'Failed to update description');
        this.savingDescription = false;
      }
    });
  }

  deleteFile(file: FileWithMeta): void {
    if (!confirm(`Are you sure you want to delete "${file.filename}"?`)) return;

    this.fileService.delete(file.id).subscribe({
      next: () => {
        this.toastService.success('File deleted');
        this.refresh();
      },
      error: (err) => {
        this.toastService.error(err?.error?.message || 'Failed to delete file');
      }
    });
  }

  restoreFile(file: FileWithMeta): void {
    this.fileService.restoreFile(file.id).subscribe({
      next: () => {
        this.toastService.success('File restored');
        this.refresh();
      },
      error: (err) => {
        this.toastService.error(err?.error?.message || 'Failed to restore file');
      }
    });
  }

  downloadFile(file: FileWithMeta): void {
    window.open(this.fileService.getDownloadUrl(file.id), '_blank');
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  refresh(): void {
    this.refreshTrigger$.next();
  }

  formatSize(bytes: number): string {
    return formatFileSize(bytes);
  }

  getFileCategory(mimeType: string): string {
    return getFileCategory(mimeType);
  }

  getTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      image: 'Images',
      document: 'Documents',
      archive: 'Archives',
      other: 'Other',
    };
    return labels[type] || type;
  }

  getFileIcon(mimeType: string): string {
    if (mimeType.startsWith('image/')) return 'fa-image';
    if (mimeType.includes('pdf')) return 'fa-file-pdf';
    if (mimeType.includes('word')) return 'fa-file-word';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'fa-file-excel';
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'fa-file-powerpoint';
    if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('archive')) return 'fa-file-archive';
    if (mimeType.startsWith('text/')) return 'fa-file-alt';
    return 'fa-file';
  }

  isImage(mimeType: string): boolean {
    return mimeType.startsWith('image/');
  }

  getThumbnailUrl(file: FileWithMeta): string {
    return this.fileService.getDownloadUrl(file.id);
  }

  getPageUrl(link: FileLinkInfo): string | null {
    if (link.linkable_type === 'page' && link.link_path) {
      return `/wiki/${link.link_path.wiki_slug}/${link.link_path.section_slug}/${link.link_path.page_slug}`;
    }
    return null;
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  formatActionLabel(action: string): string {
    const labels: Record<string, string> = {
      upload: 'Uploaded',
      download: 'Downloaded',
      delete: 'Deleted',
      restore: 'Restored',
      replace: 'Replaced',
      link: 'Linked',
      unlink: 'Unlinked',
      access_rule_add: 'Access Rule Added',
      access_rule_remove: 'Access Rule Removed',
      metadata_update: 'Metadata Updated',
    };
    return labels[action] || action;
  }

  getActionIcon(action: string): string {
    const icons: Record<string, string> = {
      upload: 'fa-upload',
      download: 'fa-download',
      delete: 'fa-trash',
      restore: 'fa-undo',
      replace: 'fa-sync',
      link: 'fa-link',
      unlink: 'fa-unlink',
      access_rule_add: 'fa-lock',
      access_rule_remove: 'fa-unlock',
      metadata_update: 'fa-edit',
    };
    return icons[action] || 'fa-circle';
  }

  // Pagination helper
  getPageNumbers(meta: { total: number; page: number; limit: number; totalPages: number }): number[] {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, meta.page - Math.floor(maxVisible / 2));
    let end = Math.min(meta.totalPages, start + maxVisible - 1);

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }

  trackByFileId(_index: number, file: FileWithMeta): number {
    return file.id;
  }
}
