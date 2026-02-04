import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import session from 'express-session';
import pgSession from 'connect-pg-simple';
import { Pool } from 'pg';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security headers via Helmet
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // TinyMCE needs these
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          fontSrc: ["'self'"],
          connectSrc: ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: false, // Allow embedding resources
    }),
  );

  // Global exception filter (prevents stack trace leakage)
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Configure body parser limits for file uploads and large page content
  // Set high limit here - actual enforcement happens in FilesService based on DB setting
  app.use(json({ limit: '100mb' }));
  app.use(urlencoded({ limit: '100mb', extended: true }));

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
