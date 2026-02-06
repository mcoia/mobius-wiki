/**
 * File attachment model matching backend response
 */
export interface FileAttachment {
  id: number;
  filename: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  description: string | null;
  uploaded_by: number;
  uploaded_at: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by: number | null;
  // Added when fetched via linked endpoint
  linked_at?: string;
  linked_by?: number;
}

/**
 * File link record (junction table)
 */
export interface FileLink {
  id: number;
  file_id: number;
  linkable_type: 'wiki' | 'section' | 'page' | 'user';
  linkable_id: number;
  created_at: string;
  created_by: number;
}

/**
 * Upload progress tracking for UI
 */
export interface UploadProgress {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'linking' | 'complete' | 'error';
  error?: string;
  result?: FileAttachment;
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Get file type category from MIME type
 */
export function getFileCategory(mimeType: string): 'image' | 'document' | 'archive' | 'code' | 'other' {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.includes('pdf') || mimeType.includes('word') ||
      mimeType.includes('excel') || mimeType.includes('spreadsheet') ||
      mimeType.includes('powerpoint') || mimeType.includes('presentation')) {
    return 'document';
  }
  if (mimeType.includes('zip') || mimeType.includes('tar') ||
      mimeType.includes('rar') || mimeType.includes('gzip')) {
    return 'archive';
  }
  if (mimeType.includes('javascript') || mimeType.includes('json') ||
      mimeType.includes('css') || mimeType.includes('html') ||
      mimeType.includes('typescript') || mimeType.includes('text/')) {
    return 'code';
  }
  return 'other';
}

/**
 * Validate file before upload
 * @param file - File to validate
 * @param maxSizeBytes - Maximum allowed file size in bytes
 */
export function validateFile(file: File, maxSizeBytes: number): { valid: boolean; error?: string } {
  if (file.size > maxSizeBytes) {
    return {
      valid: false,
      error: `File size (${formatFileSize(file.size)}) exceeds maximum of ${formatFileSize(maxSizeBytes)}`
    };
  }
  return { valid: true };
}

// =============================================================================
// ADMIN INTERFACES
// =============================================================================

/**
 * Extended file attachment with uploader info for admin panel
 */
export interface FileWithMeta extends FileAttachment {
  uploader_name: string | null;
  uploader_email: string | null;
  link_count: number;
  access_rule_count: number;
}

/**
 * Filters for admin file list
 */
export interface FileFilters {
  type?: 'image' | 'document' | 'archive' | 'other' | null;
  search?: string | null;
  uploadedBy?: number | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  orphaned?: boolean;
  includeDeleted?: boolean;
}

/**
 * Query parameters for admin file list
 */
export interface FileAdminQuery extends FileFilters {
  page?: number;
  limit?: number;
  sortBy?: 'filename' | 'size_bytes' | 'uploaded_at' | 'mime_type';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Response from admin file list endpoint
 */
export interface FileAdminResponse {
  data: FileWithMeta[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * Storage statistics for admin panel
 */
export interface StorageStats {
  totals: {
    totalFiles: number;
    totalSize: number;
    deletedFiles: number;
    deletedSize: number;
  };
  byType: {
    type: 'image' | 'document' | 'archive' | 'other';
    count: number;
    size: number;
  }[];
  topUploaders: {
    id: number;
    name: string;
    email: string;
    fileCount: number;
    totalSize: number;
  }[];
  orphanedCount: number;
}

/**
 * Linked content info for a file
 */
export interface FileLinkInfo {
  id: number;
  linkable_type: 'wiki' | 'section' | 'page' | 'user';
  linkable_id: number;
  created_at: string;
  created_by: number | null;
  created_by_name: string | null;
  linked_title: string | null;
  link_path: {
    wiki_slug: string;
    section_slug: string;
    page_slug: string;
  } | null;
}

/**
 * File audit log entry
 */
export interface FileAuditLog {
  id: number;
  file_id: number | null;
  action: 'upload' | 'download' | 'delete' | 'restore' | 'replace' |
          'link' | 'unlink' | 'access_rule_add' | 'access_rule_remove' | 'metadata_update';
  actor_id: number | null;
  actor_name: string | null;
  actor_email: string | null;
  details: Record<string, any> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}
