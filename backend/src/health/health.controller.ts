import { Controller, Get, Inject } from '@nestjs/common';
import { Pool } from 'pg';

@Controller('health')
export class HealthController {
  constructor(@Inject('DATABASE_POOL') private pool: Pool) {}

  @Get()
  async check() {
    try {
      const result = await this.pool.query('SELECT NOW()');
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: 'connected',
        dbTime: result.rows[0].now,
      };
    } catch (error) {
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        database: 'disconnected',
        error: error.message,
      };
    }
  }
}
