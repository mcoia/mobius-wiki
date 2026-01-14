import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { Pool } from 'pg';
import { CreateAccessRuleDto } from './dto/create-access-rule.dto';

@Injectable()
export class AccessRulesService {
  constructor(@Inject('DATABASE_POOL') private pool: Pool) {}

  async create(
    ruleableType: string,
    ruleableId: number,
    dto: CreateAccessRuleDto,
    userId: number,
  ) {
    // Validate rule_type and rule_value combination
    if (dto.ruleType === 'public' && dto.ruleValue) {
      throw new BadRequestException('Public rules should not have a rule_value');
    }

    if (dto.ruleType !== 'public' && !dto.ruleValue) {
      throw new BadRequestException(`Rule type '${dto.ruleType}' requires a rule_value`);
    }

    // Verify the ruleable entity exists
    await this.verifyRuleableExists(ruleableType, ruleableId);

    const { rows } = await this.pool.query(
      `INSERT INTO wiki.access_rules (ruleable_type, ruleable_id, rule_type, rule_value, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        ruleableType,
        ruleableId,
        dto.ruleType,
        dto.ruleValue || null,
        userId,
      ],
    );

    return rows[0];
  }

  async findAll(ruleableType: string, ruleableId: number) {
    await this.verifyRuleableExists(ruleableType, ruleableId);

    const { rows } = await this.pool.query(
      `SELECT * FROM wiki.access_rules
       WHERE ruleable_type = $1 AND ruleable_id = $2
       ORDER BY created_at ASC`,
      [ruleableType, ruleableId],
    );

    return rows;
  }

  async remove(ruleId: number) {
    const { rows } = await this.pool.query(
      'DELETE FROM wiki.access_rules WHERE id = $1 RETURNING *',
      [ruleId],
    );

    if (rows.length === 0) {
      throw new NotFoundException(`Access rule with ID ${ruleId} not found`);
    }

    return rows[0];
  }

  private async verifyRuleableExists(ruleableType: string, ruleableId: number) {
    const tableMap = {
      wiki: 'wikis',
      section: 'sections',
      page: 'pages',
      file: 'files',
    };

    const tableName = tableMap[ruleableType];
    if (!tableName) {
      throw new BadRequestException(`Invalid ruleable_type: ${ruleableType}`);
    }

    const { rows } = await this.pool.query(
      `SELECT id FROM wiki.${tableName} WHERE id = $1 AND deleted_at IS NULL`,
      [ruleableId],
    );

    if (rows.length === 0) {
      throw new NotFoundException(`${ruleableType} with ID ${ruleableId} not found`);
    }
  }
}
