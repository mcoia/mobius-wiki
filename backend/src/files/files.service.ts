import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { Pool } from 'pg';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

import { FileAdminQueryDto } from './dto/file-admin-query.dto';

@Injectable()
export class FilesService {
  private readonly uploadDir = path.join(process.cwd(), 'uploads');

  // Allowed MIME types for file uploads
  private readonly ALLOWED_MIME_TYPES = [
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    // Images
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    // Archives
    'application/zip',
    'application/x-zip-compressed',
  ];

  // Blocked executable extensions
  private readonly BLOCKED_EXTENSIONS = [
    '.exe',
    '.bat',
    '.cmd',
    '.sh',
    '.ps1',
    '.vbs',
    '.js',
    '.jar',
    '.msi',
    '.dll',
    '.scr',
    '.com',
    '.pif',
    '.application',
  ];

  constructor(@Inject('DATABASE_POOL') private pool: Pool) {
    this.ensureUploadDir();
  }

  /**
   * Validate file type against allowed MIME types and blocked extensions.
   */
  private validateFileType(file: Express.Multer.File): void {
    const ext = path.extname(file.originalname).toLowerCase();

    // Check blocked extensions
    if (this.BLOCKED_EXTENSIONS.includes(ext)) {
      throw new BadRequestException(`File type '${ext}' is not allowed`);
    }

    // Check MIME type
    if (!this.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type '${file.mimetype}' is not allowed. Allowed types: documents, images, archives.`,
      );
    }
  }

  /**
   * Get the configured max upload size in bytes from database settings.
   * Defaults to 50 MB if not configured.
   */
  async getMaxUploadSizeBytes(): Promise<number> {
    const { rows } = await this.pool.query(
      `SELECT value FROM wiki.settings WHERE key = 'max_upload_size_mb'`,
    );
    const maxMb = rows.length > 0 ? parseInt(rows[0].value, 10) : 50;
    return maxMb * 1024 * 1024;
  }

  private async ensureUploadDir() {
    try {
      await fs.access(this.uploadDir);
    } catch {
      await fs.mkdir(this.uploadDir, { recursive: true });
    }
  }

  async upload(
    file: Express.Multer.File,
    userId: number,
    description?: string,
  ) {
    // Validate file type first (security check)
    this.validateFileType(file);

    // Validate file size against configured limit
    const maxSizeBytes = await this.getMaxUploadSizeBytes();
    if (file.size > maxSizeBytes) {
      const maxMb = maxSizeBytes / (1024 * 1024);
      const fileMb = (file.size / (1024 * 1024)).toFixed(2);
      throw new BadRequestException(
        `File size (${fileMb} MB) exceeds maximum allowed size (${maxMb} MB)`,
      );
    }

    // Generate unique filename
    const fileHash = crypto.randomBytes(16).toString('hex');
    const ext = path.extname(file.originalname);
    const filename = `${file.originalname}_${fileHash}${ext}`;
    const storagePath = `uploads/${filename}`;
    const fullPath = path.join(this.uploadDir, filename);

    // Save file to disk
    await fs.writeFile(fullPath, file.buffer);

    // Save metadata to database (note: description not in schema, original_filename stored in filename)
    const { rows } = await this.pool.query(
      `INSERT INTO wiki.files (filename, storage_path, mime_type, size_bytes, uploaded_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        file.originalname,  // Store original filename
        storagePath,
        file.mimetype,
        file.size,
        userId,
      ],
    );

    return rows[0];
  }

  async findOne(id: number, includeDeleted = false) {
    const whereClause = includeDeleted
      ? 'WHERE id = $1'
      : 'WHERE id = $1 AND deleted_at IS NULL';

    const { rows } = await this.pool.query(
      `SELECT * FROM wiki.files ${whereClause}`,
      [id],
    );

    if (rows.length === 0) {
      throw new NotFoundException(`File with ID ${id} not found`);
    }

    return rows[0];
  }

  async findAll(includeDeleted = false) {
    const whereClause = includeDeleted ? '' : 'WHERE deleted_at IS NULL';

    const { rows } = await this.pool.query(
      `SELECT * FROM wiki.files ${whereClause} ORDER BY created_at DESC`,
    );

    return {
      data: rows,
      meta: { total: rows.length },
    };
  }

  async getFileBuffer(id: number): Promise<Buffer> {
    const file = await this.findOne(id);
    const fullPath = path.join(process.cwd(), file.storage_path);

    try {
      return await fs.readFile(fullPath);
    } catch (error) {
      throw new NotFoundException(`File data not found on disk`);
    }
  }

  async remove(id: number, userId: number) {
    const { rows } = await this.pool.query(
      `UPDATE wiki.files
       SET deleted_at = NOW(),
           deleted_by = $2,
           updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      [id, userId],
    );

    if (rows.length === 0) {
      throw new NotFoundException(`File with ID ${id} not found`);
    }

    return rows[0];
  }

  async linkToContent(fileId: number, linkableType: string, linkableId: number, userId: number) {
    // Verify file exists
    await this.findOne(fileId);

    // Verify linkable entity exists
    await this.verifyLinkableExists(linkableType, linkableId);

    // Create file link
    const { rows } = await this.pool.query(
      `INSERT INTO wiki.file_links (file_id, linkable_type, linkable_id, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [fileId, linkableType, linkableId, userId],
    );

    return rows[0];
  }

  async unlinkFromContent(fileId: number, linkableType: string, linkableId: number) {
    const { rows } = await this.pool.query(
      `DELETE FROM wiki.file_links
       WHERE file_id = $1 AND linkable_type = $2 AND linkable_id = $3
       RETURNING *`,
      [fileId, linkableType, linkableId],
    );

    if (rows.length === 0) {
      throw new NotFoundException('File link not found');
    }

    return rows[0];
  }

  async findLinkedFiles(linkableType: string, linkableId: number) {
    const { rows } = await this.pool.query(
      `SELECT f.*, fl.created_at as linked_at, fl.created_by as linked_by
       FROM wiki.file_links fl
       JOIN wiki.files f ON fl.file_id = f.id
       WHERE fl.linkable_type = $1 AND fl.linkable_id = $2 AND f.deleted_at IS NULL
       ORDER BY fl.created_at DESC`,
      [linkableType, linkableId],
    );

    return {
      data: rows,
      meta: { total: rows.length },
    };
  }

  private async verifyLinkableExists(linkableType: string, linkableId: number) {
    const tableMap = {
      wiki: 'wikis',
      section: 'sections',
      page: 'pages',
      user: 'users',
    };

    const tableName = tableMap[linkableType];
    if (!tableName) {
      throw new BadRequestException(`Invalid linkable_type: ${linkableType}`);
    }

    const { rows } = await this.pool.query(
      `SELECT id FROM wiki.${tableName} WHERE id = $1 AND deleted_at IS NULL`,
      [linkableId],
    );

    if (rows.length === 0) {
      throw new NotFoundException(`${linkableType} with ID ${linkableId} not found`);
    }
  }

  // ==========================================================================
  // ADMIN METHODS
  // ==========================================================================

  /**
   * Get files with filters, pagination, and sorting for admin panel
   */
  async findAllAdmin(query: FileAdminQueryDto) {
    const {
      type,
      uploadedBy,
      dateFrom,
      dateTo,
      search,
      orphaned,
      includeDeleted = false,
      page = 1,
      limit = 25,
      sortBy = 'uploaded_at',
      sortOrder = 'desc',
    } = query;

    const offset = (page - 1) * limit;
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Base deleted filter
    if (!includeDeleted) {
      conditions.push(`f.deleted_at IS NULL`);
    }

    // Type filter (based on MIME type)
    if (type) {
      switch (type) {
        case 'image':
          conditions.push(`f.mime_type LIKE 'image/%'`);
          break;
        case 'document':
          conditions.push(`(f.mime_type LIKE '%pdf%' OR f.mime_type LIKE '%word%' OR f.mime_type LIKE '%excel%' OR f.mime_type LIKE '%spreadsheet%' OR f.mime_type LIKE '%powerpoint%' OR f.mime_type LIKE '%presentation%' OR f.mime_type LIKE 'text/%')`);
          break;
        case 'archive':
          conditions.push(`(f.mime_type LIKE '%zip%' OR f.mime_type LIKE '%tar%' OR f.mime_type LIKE '%rar%' OR f.mime_type LIKE '%gzip%')`);
          break;
        case 'other':
          conditions.push(`NOT (f.mime_type LIKE 'image/%' OR f.mime_type LIKE '%pdf%' OR f.mime_type LIKE '%word%' OR f.mime_type LIKE '%excel%' OR f.mime_type LIKE '%zip%')`);
          break;
      }
    }

    // Uploader filter
    if (uploadedBy) {
      conditions.push(`f.uploaded_by = $${paramIndex}`);
      params.push(uploadedBy);
      paramIndex++;
    }

    // Date range filter
    if (dateFrom) {
      conditions.push(`f.uploaded_at >= $${paramIndex}`);
      params.push(dateFrom);
      paramIndex++;
    }
    if (dateTo) {
      conditions.push(`f.uploaded_at <= $${paramIndex}`);
      params.push(dateTo);
      paramIndex++;
    }

    // Search filter
    if (search) {
      conditions.push(`(f.filename ILIKE $${paramIndex} OR f.description ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Orphaned filter (files not linked to any content)
    let joinClause = '';
    if (orphaned) {
      joinClause = `LEFT JOIN wiki.file_links fl ON f.id = fl.file_id`;
      conditions.push(`fl.id IS NULL`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countQuery = `
      SELECT COUNT(DISTINCT f.id) as total
      FROM wiki.files f
      ${joinClause}
      ${whereClause}
    `;
    const countResult = await this.pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total, 10);

    // Validate sort column (prevent SQL injection)
    const validSortColumns = ['filename', 'size_bytes', 'uploaded_at', 'mime_type'];
    const safeSort = validSortColumns.includes(sortBy) ? sortBy : 'uploaded_at';
    const safeOrder = sortOrder === 'asc' ? 'ASC' : 'DESC';

    // Get paginated data with uploader info
    const dataQuery = `
      SELECT
        f.*,
        u.name as uploader_name,
        u.email as uploader_email,
        (SELECT COUNT(*) FROM wiki.file_links fl WHERE fl.file_id = f.id) as link_count,
        (SELECT COUNT(*) FROM wiki.access_rules ar WHERE ar.ruleable_type = 'file' AND ar.ruleable_id = f.id) as access_rule_count
      FROM wiki.files f
      LEFT JOIN wiki.users u ON f.uploaded_by = u.id
      ${joinClause}
      ${whereClause}
      GROUP BY f.id, u.name, u.email
      ORDER BY f.${safeSort} ${safeOrder}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, offset);

    const dataResult = await this.pool.query(dataQuery, params);

    return {
      data: dataResult.rows,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get storage statistics
   */
  async getStorageStats() {
    // Total files and size
    const totalsQuery = `
      SELECT
        COUNT(*) as total_files,
        COALESCE(SUM(size_bytes), 0) as total_size,
        COUNT(*) FILTER (WHERE deleted_at IS NOT NULL) as deleted_files,
        COALESCE(SUM(size_bytes) FILTER (WHERE deleted_at IS NOT NULL), 0) as deleted_size
      FROM wiki.files
    `;
    const totalsResult = await this.pool.query(totalsQuery);

    // Files by type
    const typeQuery = `
      SELECT
        CASE
          WHEN mime_type LIKE 'image/%' THEN 'image'
          WHEN mime_type LIKE '%pdf%' OR mime_type LIKE '%word%' OR mime_type LIKE '%excel%' OR mime_type LIKE '%spreadsheet%' OR mime_type LIKE '%powerpoint%' OR mime_type LIKE '%presentation%' OR mime_type LIKE 'text/%' THEN 'document'
          WHEN mime_type LIKE '%zip%' OR mime_type LIKE '%tar%' OR mime_type LIKE '%rar%' OR mime_type LIKE '%gzip%' THEN 'archive'
          ELSE 'other'
        END as type,
        COUNT(*) as count,
        COALESCE(SUM(size_bytes), 0) as size
      FROM wiki.files
      WHERE deleted_at IS NULL
      GROUP BY 1
      ORDER BY count DESC
    `;
    const typeResult = await this.pool.query(typeQuery);

    // Top uploaders
    const uploadersQuery = `
      SELECT
        u.id,
        u.name,
        u.email,
        COUNT(*) as file_count,
        COALESCE(SUM(f.size_bytes), 0) as total_size
      FROM wiki.files f
      JOIN wiki.users u ON f.uploaded_by = u.id
      WHERE f.deleted_at IS NULL
      GROUP BY u.id, u.name, u.email
      ORDER BY file_count DESC
      LIMIT 10
    `;
    const uploadersResult = await this.pool.query(uploadersQuery);

    // Orphaned files count
    const orphanedQuery = `
      SELECT COUNT(*) as count
      FROM wiki.files f
      LEFT JOIN wiki.file_links fl ON f.id = fl.file_id
      WHERE f.deleted_at IS NULL AND fl.id IS NULL
    `;
    const orphanedResult = await this.pool.query(orphanedQuery);

    return {
      totals: {
        totalFiles: parseInt(totalsResult.rows[0].total_files, 10),
        totalSize: parseInt(totalsResult.rows[0].total_size, 10),
        deletedFiles: parseInt(totalsResult.rows[0].deleted_files, 10),
        deletedSize: parseInt(totalsResult.rows[0].deleted_size, 10),
      },
      byType: typeResult.rows.map(row => ({
        type: row.type,
        count: parseInt(row.count, 10),
        size: parseInt(row.size, 10),
      })),
      topUploaders: uploadersResult.rows.map(row => ({
        id: row.id,
        name: row.name,
        email: row.email,
        fileCount: parseInt(row.file_count, 10),
        totalSize: parseInt(row.total_size, 10),
      })),
      orphanedCount: parseInt(orphanedResult.rows[0].count, 10),
    };
  }

  /**
   * Get orphaned files (files not linked to any content)
   */
  async findOrphaned() {
    const { rows } = await this.pool.query(`
      SELECT
        f.*,
        u.name as uploader_name,
        u.email as uploader_email
      FROM wiki.files f
      LEFT JOIN wiki.file_links fl ON f.id = fl.file_id
      LEFT JOIN wiki.users u ON f.uploaded_by = u.id
      WHERE f.deleted_at IS NULL AND fl.id IS NULL
      ORDER BY f.uploaded_at DESC
    `);

    return {
      data: rows,
      meta: { total: rows.length },
    };
  }

  /**
   * Get all content linked to a file
   * Optimized: Simple query with separate title lookups instead of 9 JOINs
   */
  async getFileLinks(fileId: number) {
    // Verify file exists
    await this.findOne(fileId, true);

    // Simple query: just file_links + user who created link
    const { rows } = await this.pool.query(`
      SELECT
        fl.id,
        fl.linkable_type,
        fl.linkable_id,
        fl.created_at,
        fl.created_by,
        u.name as created_by_name
      FROM wiki.file_links fl
      LEFT JOIN wiki.users u ON fl.created_by = u.id
      WHERE fl.file_id = $1
      ORDER BY fl.created_at DESC
      LIMIT 50
    `, [fileId]);

    // Hydrate titles and link paths with individual lookups
    for (const row of rows) {
      const linkInfo = await this.getLinkableInfo(row.linkable_type, row.linkable_id);
      row.linked_title = linkInfo.title;
      row.link_path = linkInfo.path;
    }

    return {
      data: rows,
      meta: { total: rows.length },
    };
  }

  /**
   * Get title and path info for a linkable entity
   */
  private async getLinkableInfo(type: string, id: number): Promise<{ title: string | null; path: any }> {
    switch (type) {
      case 'wiki': {
        const { rows } = await this.pool.query('SELECT title FROM wiki.wikis WHERE id = $1', [id]);
        return { title: rows[0]?.title || null, path: null };
      }
      case 'section': {
        const { rows } = await this.pool.query('SELECT title FROM wiki.sections WHERE id = $1', [id]);
        return { title: rows[0]?.title || null, path: null };
      }
      case 'page': {
        const { rows } = await this.pool.query(`
          SELECT p.title, p.slug as page_slug, s.slug as section_slug, w.slug as wiki_slug
          FROM wiki.pages p
          LEFT JOIN wiki.sections s ON p.section_id = s.id
          LEFT JOIN wiki.wikis w ON s.wiki_id = w.id
          WHERE p.id = $1
        `, [id]);
        if (rows.length === 0) return { title: null, path: null };
        return {
          title: rows[0].title,
          path: {
            wiki_slug: rows[0].wiki_slug,
            section_slug: rows[0].section_slug,
            page_slug: rows[0].page_slug,
          },
        };
      }
      case 'user': {
        const { rows } = await this.pool.query('SELECT name FROM wiki.users WHERE id = $1', [id]);
        return { title: rows[0]?.name || null, path: null };
      }
      default:
        return { title: null, path: null };
    }
  }

  /**
   * Update file metadata (description)
   */
  async updateMetadata(fileId: number, data: { description?: string }) {
    const file = await this.findOne(fileId);

    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (data.description !== undefined) {
      updates.push(`description = $${paramIndex}`);
      params.push(data.description);
      paramIndex++;
    }

    if (updates.length === 0) {
      return file;
    }

    updates.push(`updated_at = NOW()`);
    params.push(fileId);

    const { rows } = await this.pool.query(
      `UPDATE wiki.files
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      params,
    );

    return rows[0];
  }

  /**
   * Replace file content (upload new file, keep same ID)
   */
  async replaceFile(fileId: number, file: Express.Multer.File, userId: number) {
    const existingFile = await this.findOne(fileId);

    // Validate file type
    this.validateFileType(file);

    // Validate file size
    const maxSizeBytes = await this.getMaxUploadSizeBytes();
    if (file.size > maxSizeBytes) {
      const maxMb = maxSizeBytes / (1024 * 1024);
      const fileMb = (file.size / (1024 * 1024)).toFixed(2);
      throw new BadRequestException(
        `File size (${fileMb} MB) exceeds maximum allowed size (${maxMb} MB)`,
      );
    }

    // Generate new storage path
    const fileHash = crypto.randomBytes(16).toString('hex');
    const ext = path.extname(file.originalname);
    const filename = `${file.originalname}_${fileHash}${ext}`;
    const storagePath = `uploads/${filename}`;
    const fullPath = path.join(this.uploadDir, filename);

    // Save new file to disk
    await fs.writeFile(fullPath, file.buffer);

    // Delete old file from disk (best effort)
    try {
      const oldFullPath = path.join(process.cwd(), existingFile.storage_path);
      await fs.unlink(oldFullPath);
    } catch (error) {
      // Ignore if old file doesn't exist
    }

    // Update database record
    const { rows } = await this.pool.query(
      `UPDATE wiki.files
       SET filename = $1,
           storage_path = $2,
           mime_type = $3,
           size_bytes = $4,
           updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [file.originalname, storagePath, file.mimetype, file.size, fileId],
    );

    return rows[0];
  }

  /**
   * Restore a soft-deleted file
   */
  async restore(fileId: number) {
    const { rows } = await this.pool.query(
      `UPDATE wiki.files
       SET deleted_at = NULL,
           deleted_by = NULL,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [fileId],
    );

    if (rows.length === 0) {
      throw new NotFoundException(`File with ID ${fileId} not found`);
    }

    return rows[0];
  }
}
