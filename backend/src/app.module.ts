import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';
import { DatabaseModule } from './database/database.module';
import { MailerModule } from './mailer/mailer.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { AccessControlModule } from './access-control/access-control.module';
import { AccessRulesModule } from './access-rules/access-rules.module';
import { WikisModule } from './wikis/wikis.module';
import { SectionsModule } from './sections/sections.module';
import { PagesModule } from './pages/pages.module';
import { FilesModule } from './files/files.module';
import { SearchModule } from './search/search.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { NavigationModule } from './navigation/navigation.module';
import { AdminModule } from './admin/admin.module';
import { StaffModule } from './staff/staff.module';
import { PublicSettingsModule } from './settings/public-settings.module';
import { SeoModule } from './seo/seo.module';
import { ExportModule } from './export/export.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute window
        limit: 100, // 100 requests per minute (general)
      },
    ]),
    DatabaseModule,
    MailerModule,
    AuthModule,
    AccessControlModule,
    AccessRulesModule,
    HealthModule,
    WikisModule,
    SectionsModule,
    PagesModule,
    FilesModule,
    SearchModule,
    AnalyticsModule,
    NavigationModule,
    AdminModule,
    StaffModule,
    PublicSettingsModule,
    SeoModule,
    ExportModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}
