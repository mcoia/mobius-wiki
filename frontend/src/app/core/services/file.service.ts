import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  FileAttachment,
  FileLink,
  FileAdminQuery,
  FileAdminResponse,
  FileWithMeta,
  StorageStats,
  FileLinkInfo,
  FileAuditLog,
} from '../models/file.model';

/**
 * Service for file upload, download, and linking operations.
 * Uses HttpClient directly (not ApiService) for FormData uploads.
 */
@Injectable({
  providedIn: 'root'
})
export class FileService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /**
   * Upload a file with progress tracking
   */
  upload(file: File, description?: string): Observable<HttpEvent<{ data: FileAttachment }>> {
    const formData = new FormData();
    formData.append('file', file);
    if (description) {
      formData.append('description', description);
    }

    return this.http.post<{ data: FileAttachment }>(
      `${this.apiUrl}/files`,
      formData,
      {
        reportProgress: true,
        observe: 'events'
      }
    );
  }

  /**
   * Simple upload without progress tracking
   */
  uploadSimple(file: File, description?: string): Observable<{ data: FileAttachment }> {
    const formData = new FormData();
    formData.append('file', file);
    if (description) {
      formData.append('description', description);
    }

    return this.http.post<{ data: FileAttachment }>(
      `${this.apiUrl}/files`,
      formData
    );
  }

  /**
   * Get file metadata by ID
   */
  getFile(fileId: number): Observable<{ data: FileAttachment }> {
    return this.http.get<{ data: FileAttachment }>(
      `${this.apiUrl}/files/${fileId}`
    );
  }

  /**
   * Delete a file (soft delete)
   */
  delete(fileId: number): Observable<{ data: FileAttachment }> {
    return this.http.delete<{ data: FileAttachment }>(
      `${this.apiUrl}/files/${fileId}`
    );
  }

  /**
   * Link a file to a page
   * @param context - 'attachment' for panel uploads, 'inline' for embedded images
   */
  linkToPage(
    fileId: number,
    pageId: number,
    context: 'attachment' | 'inline' | 'cover' | 'thumbnail' = 'attachment'
  ): Observable<{ data: FileLink }> {
    return this.http.post<{ data: FileLink }>(
      `${this.apiUrl}/files/${fileId}/link/pages/${pageId}`,
      { context }
    );
  }

  /**
   * Unlink a file from a page
   */
  unlinkFromPage(fileId: number, pageId: number): Observable<{ data: FileLink }> {
    return this.http.delete<{ data: FileLink }>(
      `${this.apiUrl}/files/${fileId}/link/pages/${pageId}`
    );
  }

  /**
   * Get all files linked to a page
   * @param context - Optional filter: 'attachment', 'inline', 'cover', 'thumbnail'
   */
  getLinkedFiles(
    pageId: number,
    context?: 'attachment' | 'inline' | 'cover' | 'thumbnail'
  ): Observable<{ data: FileAttachment[]; meta: { total: number } }> {
    let params = new HttpParams();
    if (context) {
      params = params.set('context', context);
    }
    return this.http.get<{ data: FileAttachment[]; meta: { total: number } }>(
      `${this.apiUrl}/files/linked/pages/${pageId}`,
      { params }
    );
  }

  /**
   * Get download URL for a file (opens in browser)
   */
  getDownloadUrl(fileId: number): string {
    return `${this.apiUrl}/files/${fileId}/download`;
  }

  // ==========================================================================
  // ADMIN METHODS
  // ==========================================================================

  /**
   * Get files with filters, pagination, and sorting for admin panel
   */
  getFilesAdmin(query: FileAdminQuery): Observable<FileAdminResponse> {
    let params = new HttpParams();

    if (query.type) params = params.set('type', query.type);
    if (query.uploadedBy) params = params.set('uploadedBy', query.uploadedBy.toString());
    if (query.dateFrom) params = params.set('dateFrom', query.dateFrom);
    if (query.dateTo) params = params.set('dateTo', query.dateTo);
    if (query.search) params = params.set('search', query.search);
    if (query.orphaned) params = params.set('orphaned', 'true');
    if (query.includeDeleted) params = params.set('includeDeleted', 'true');
    if (query.page) params = params.set('page', query.page.toString());
    if (query.limit) params = params.set('limit', query.limit.toString());
    if (query.sortBy) params = params.set('sortBy', query.sortBy);
    if (query.sortOrder) params = params.set('sortOrder', query.sortOrder);

    return this.http.get<FileAdminResponse>(`${this.apiUrl}/files/admin`, { params });
  }

  /**
   * Get storage statistics
   */
  getStorageStats(): Observable<{ data: StorageStats }> {
    return this.http.get<{ data: StorageStats }>(`${this.apiUrl}/files/admin/stats`);
  }

  /**
   * Get orphaned files (files not linked to any content)
   */
  getOrphanedFiles(): Observable<{ data: FileWithMeta[]; meta: { total: number } }> {
    return this.http.get<{ data: FileWithMeta[]; meta: { total: number } }>(`${this.apiUrl}/files/admin/orphaned`);
  }

  /**
   * Get content linked to a file
   */
  getFileLinks(fileId: number): Observable<{ data: FileLinkInfo[]; meta: { total: number } }> {
    return this.http.get<{ data: FileLinkInfo[]; meta: { total: number } }>(`${this.apiUrl}/files/${fileId}/links`);
  }

  /**
   * Get audit logs for a file
   */
  getFileAuditLogs(fileId: number, limit = 50): Observable<{ data: FileAuditLog[] }> {
    const params = new HttpParams().set('limit', limit.toString());
    return this.http.get<{ data: FileAuditLog[] }>(`${this.apiUrl}/files/${fileId}/audit-logs`, { params });
  }

  /**
   * Update file metadata
   */
  updateFile(fileId: number, data: { description?: string }): Observable<{ data: FileAttachment }> {
    return this.http.patch<{ data: FileAttachment }>(`${this.apiUrl}/files/${fileId}`, data);
  }

  /**
   * Replace file content with progress tracking
   */
  replaceFile(fileId: number, file: File): Observable<HttpEvent<{ data: FileAttachment }>> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<{ data: FileAttachment }>(
      `${this.apiUrl}/files/${fileId}/replace`,
      formData,
      {
        reportProgress: true,
        observe: 'events'
      }
    );
  }

  /**
   * Restore a soft-deleted file
   */
  restoreFile(fileId: number): Observable<{ data: FileAttachment }> {
    return this.http.post<{ data: FileAttachment }>(`${this.apiUrl}/files/${fileId}/restore`, {});
  }
}
