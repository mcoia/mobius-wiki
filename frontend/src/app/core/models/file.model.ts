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
