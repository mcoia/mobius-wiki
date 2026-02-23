import { Module } from '@nestjs/common';
import { Pool } from 'pg';

const databasePoolFactory = {
  provide: 'DATABASE_POOL',
  useFactory: () => {
    return new Pool({
      host: process.env.DATABASE_HOST,
      port: parseInt(process.env.DATABASE_PORT, 10) || 5432,
      database: process.env.DATABASE_NAME,
      user: process.env.DATABASE_USER,
      password: process.env.DATABASE_PASSWORD,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  },
};

@Module({
  providers: [databasePoolFactory],
  exports: ['DATABASE_POOL'],
})
export class DatabaseModule {}
