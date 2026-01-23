import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
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
  ],
})
export class AppModule {}
