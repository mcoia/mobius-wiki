import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { Pool } from 'pg';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { wrapData } from '../../common/utils/response.util';

@Injectable()
export class AdminSettingsService {
  constructor(@Inject('DATABASE_POOL') private pool: Pool) {}

  async findAll() {
    const { rows } = await this.pool.query(
      'SELECT key, value, description, value_type, created_at, updated_at FROM wiki.settings ORDER BY key'
    );

    return {
      data: rows.map(this.mapSetting),
      meta: { total: rows.length },
    };
  }

  async findOne(key: string) {
    const { rows } = await this.pool.query(
      'SELECT key, value, description, value_type, created_at, updated_at FROM wiki.settings WHERE key = $1',
      [key]
    );

    if (rows.length === 0) {
      throw new NotFoundException(`Setting '${key}' not found`);
    }

    return wrapData(this.mapSetting(rows[0]));
  }

  async update(key: string, dto: UpdateSettingDto) {
    // First get the setting to validate the value type
    const { rows: existing } = await this.pool.query(
      'SELECT value_type FROM wiki.settings WHERE key = $1',
      [key]
    );

    if (existing.length === 0) {
      throw new NotFoundException(`Setting '${key}' not found`);
    }

    const valueType = existing[0].value_type;

    // Validate value based on type
    this.validateValue(dto.value, valueType);

    const { rows } = await this.pool.query(
      `UPDATE wiki.settings
       SET value = $2, updated_at = NOW()
       WHERE key = $1
       RETURNING key, value, description, value_type, created_at, updated_at`,
      [key, dto.value]
    );

    return wrapData(this.mapSetting(rows[0]));
  }

  private validateValue(value: string, valueType: string): void {
    switch (valueType) {
      case 'number':
        if (isNaN(Number(value))) {
          throw new BadRequestException(`Value must be a valid number`);
        }
        break;
      case 'boolean':
        if (value !== 'true' && value !== 'false') {
          throw new BadRequestException(`Value must be 'true' or 'false'`);
        }
        break;
      case 'json':
        try {
          JSON.parse(value);
        } catch {
          throw new BadRequestException(`Value must be valid JSON`);
        }
        break;
      // 'string' type accepts any value
    }
  }

  private mapSetting(row: any) {
    return {
      key: row.key,
      value: row.value,
      description: row.description,
      valueType: row.value_type,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
