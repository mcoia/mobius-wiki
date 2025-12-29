import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import session from 'express-session';
import pgSession from 'connect-pg-simple';
import { Pool } from 'pg';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Session configuration
  const PostgresStore = pgSession(session);
  const dbPool = new Pool({
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT, 10),
    database: process.env.DATABASE_NAME,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
  });

  app.use(
    session({
      store: new PostgresStore({
        pool: dbPool,
        tableName: 'sessions',
        schemaName: 'wiki', // IMPORTANT: sessions table is in wiki schema
        createTableIfMissing: false, // Table already exists
      }),
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 24 * 60 * 60 * 1000, // 24 hours default
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      },
    }),
  );

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // CORS (for Angular frontend)
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:4200',
    credentials: true, // Important for sessions
  });

  const port = process.env.PORT || 10000;
  await app.listen(port);
  console.log(`Application running on: http://localhost:${port}`);
  console.log(`Health check: http://localhost:${port}/api/v1/health`);
}

bootstrap();
