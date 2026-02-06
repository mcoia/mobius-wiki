import { Controller, Get, Header, Res } from '@nestjs/common';
import { Response } from 'express';
import { SeoService } from './seo.service';

@Controller()
export class SeoController {
  constructor(private readonly seoService: SeoService) {}

  @Get('robots.txt')
  @Header('Content-Type', 'text/plain')
  getRobotsTxt(): string {
    return this.seoService.getRobotsTxt();
  }

  @Get('sitemap.xml')
  async getSitemapXml(@Res() res: Response): Promise<void> {
    const xml = await this.seoService.getSitemapXml();
    res.header('Content-Type', 'application/xml');
    res.send(xml);
  }
}
