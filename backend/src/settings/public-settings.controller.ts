import { Controller, Get, Inject } from '@nestjs/common';
import { Pool } from 'pg';

/**
 * Public settings controller for frontend configuration values.
 * No authentication required - these are safe public settings.
 */
@Controller('settings')
export class PublicSettingsController {
  constructor(@Inject('DATABASE_POOL') private pool: Pool) {}

  /**
   * Get upload size limit configuration.
   * Returns the max upload size in MB and bytes for frontend validation.
   */
  @Get('public/upload-limit')
  async getUploadLimit(): Promise<{
    maxUploadSizeMb: number;
    maxUploadSizeBytes: number;
  }> {
    const { rows } = await this.pool.query(
      `SELECT value FROM wiki.settings WHERE key = 'max_upload_size_mb'`,
    );

    // Default to 50 MB if not set
    const maxUploadSizeMb = rows.length > 0 ? parseInt(rows[0].value, 10) : 50;
    const maxUploadSizeBytes = maxUploadSizeMb * 1024 * 1024;

    return {
      maxUploadSizeMb,
      maxUploadSizeBytes,
    };
  }
}
