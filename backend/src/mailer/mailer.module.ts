import { Module, Global } from '@nestjs/common';
import { MailerService } from './mailer.service';
import { DatabaseModule } from '../database/database.module';

@Global()
@Module({
  imports: [DatabaseModule],
  providers: [MailerService],
  exports: [MailerService],
})
export class MailerModule {}
