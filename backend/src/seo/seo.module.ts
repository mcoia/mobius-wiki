import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { SeoController } from './seo.controller';
import { SeoService } from './seo.service';

@Module({
  imports: [DatabaseModule],
  controllers: [SeoController],
  providers: [SeoService],
})
export class SeoModule {}
