import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { FileAttachment, FileLink } from '../models/file.model';

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
   */
  linkToPage(fileId: number, pageId: number): Observable<{ data: FileLink }> {
    return this.http.post<{ data: FileLink }>(
      `${this.apiUrl}/files/${fileId}/link/pages/${pageId}`,
      {}
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
   */
  getLinkedFiles(pageId: number): Observable<{ data: FileAttachment[]; meta: { total: number } }> {
    return this.http.get<{ data: FileAttachment[]; meta: { total: number } }>(
      `${this.apiUrl}/files/linked/pages/${pageId}`
    );
  }

  /**
   * Get download URL for a file (opens in browser)
   */
  getDownloadUrl(fileId: number): string {
    return `${this.apiUrl}/files/${fileId}/download`;
  }
}
