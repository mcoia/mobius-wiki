import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { wrapData, wrapCollection } from '../../common/utils/response.util';

export interface AccessRuleFilter {
  ruleableType?: string;
  ruleType?: string;
}

@Injectable()
export class StaffAccessRulesService {
  constructor(@Inject('DATABASE_POOL') private pool: Pool) {}

  async findAll(filters: AccessRuleFilter = {}) {
    let whereClause = '1=1';
    const values: any[] = [];
    let paramCount = 1;

    if (filters.ruleableType) {
      whereClause += ` AND ar.ruleable_type = $${paramCount}`;
      values.push(filters.ruleableType);
      paramCount++;
    }

    if (filters.ruleType) {
      whereClause += ` AND ar.rule_type = $${paramCount}`;
      values.push(filters.ruleType);
      paramCount++;
    }

    const { rows } = await this.pool.query(
      `SELECT ar.*,
        CASE ar.ruleable_type
          WHEN 'wiki' THEN (SELECT title FROM wiki.wikis WHERE id = ar.ruleable_id)
          WHEN 'section' THEN (SELECT title FROM wiki.sections WHERE id = ar.ruleable_id)
          WHEN 'page' THEN (SELECT title FROM wiki.pages WHERE id = ar.ruleable_id)
          WHEN 'file' THEN (SELECT filename FROM wiki.files WHERE id = ar.ruleable_id)
        END as ruleable_name,
        u.name as created_by_name
       FROM wiki.access_rules ar
       LEFT JOIN wiki.users u ON ar.created_by = u.id
       WHERE ${whereClause}
       ORDER BY ar.created_at DESC`,
      values
    );

    return wrapCollection(rows.map(this.mapAccessRule));
  }

  async findOne(id: number) {
    const { rows } = await this.pool.query(
      `SELECT ar.*,
        CASE ar.ruleable_type
          WHEN 'wiki' THEN (SELECT title FROM wiki.wikis WHERE id = ar.ruleable_id)
          WHEN 'section' THEN (SELECT title FROM wiki.sections WHERE id = ar.ruleable_id)
          WHEN 'page' THEN (SELECT title FROM wiki.pages WHERE id = ar.ruleable_id)
          WHEN 'file' THEN (SELECT filename FROM wiki.files WHERE id = ar.ruleable_id)
        END as ruleable_name,
        u.name as created_by_name
       FROM wiki.access_rules ar
       LEFT JOIN wiki.users u ON ar.created_by = u.id
       WHERE ar.id = $1`,
      [id]
    );

    if (rows.length === 0) {
      throw new NotFoundException(`Access rule with ID ${id} not found`);
    }

    return wrapData(this.mapAccessRule(rows[0]));
  }

  async remove(id: number) {
    // Verify rule exists first
    await this.findOne(id);

    const { rows } = await this.pool.query(
      `DELETE FROM wiki.access_rules WHERE id = $1 RETURNING *`,
      [id]
    );

    if (rows.length === 0) {
      throw new NotFoundException(`Access rule with ID ${id} not found`);
    }

    return wrapData(this.mapAccessRule(rows[0]));
  }

  private mapAccessRule(row: any) {
    return {
      id: row.id,
      ruleableType: row.ruleable_type,
      ruleableId: row.ruleable_id,
      ruleableName: row.ruleable_name || null,
      ruleType: row.rule_type,
      ruleValue: row.rule_value,
      createdAt: row.created_at,
      createdBy: row.created_by,
      createdByName: row.created_by_name || null,
    };
  }
}
