import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { Pool } from 'pg';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

@Injectable()
export class FilesService {
  private readonly uploadDir = path.join(process.cwd(), 'uploads');

  constructor(@Inject('DATABASE_POOL') private pool: Pool) {
    this.ensureUploadDir();
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
}
