import { Controller, Get, Param, Res, UseGuards, ParseIntPipe, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { AccessControlGuard } from '../access-control/access-control.guard';
import { SetMetadata } from '@nestjs/common';
import { User } from '../common/decorators/user.decorator';
import { ExportService } from './export.service';

interface UserData {
  id: number;
  role?: string;
  libraryId?: number | null;
}

@Controller()
export class ExportController {
  constructor(private exportService: ExportService) {}

  /**
   * Export a single page as PDF
   */
  @Get('pages/:id/export/pdf')
  @UseGuards(AccessControlGuard)
  @SetMetadata('aclCheck', { type: 'page', idParam: 'id' })
  async exportPageToPdf(
    @Param('id', ParseIntPipe) id: number,
    @User() user: UserData | null,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const pdfBuffer = await this.exportService.exportPageToPdf(id, user);

      // Get page info for filename
      const filename = await this.getPageFilename(id, 'pdf');

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length,
      });

      res.status(HttpStatus.OK).send(pdfBuffer);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Export a single page as Markdown
   */
  @Get('pages/:id/export/markdown')
  @UseGuards(AccessControlGuard)
  @SetMetadata('aclCheck', { type: 'page', idParam: 'id' })
  async exportPageToMarkdown(
    @Param('id', ParseIntPipe) id: number,
    @User() user: UserData | null,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const markdown = await this.exportService.exportPageToMarkdown(id, user);

      const filename = await this.getPageFilename(id, 'md');

      res.set({
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': Buffer.byteLength(markdown, 'utf8'),
      });

      res.status(HttpStatus.OK).send(markdown);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Export an entire wiki as PDF
   */
  @Get('wikis/:id/export/pdf')
  @UseGuards(AccessControlGuard)
  @SetMetadata('aclCheck', { type: 'wiki', idParam: 'id' })
  async exportWikiToPdf(
    @Param('id', ParseIntPipe) id: number,
    @User() user: UserData | null,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const pdfBuffer = await this.exportService.exportWikiToPdf(id, user);

      const filename = await this.getWikiFilename(id, 'pdf');

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length,
      });

      res.status(HttpStatus.OK).send(pdfBuffer);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Export an entire wiki as Markdown
   */
  @Get('wikis/:id/export/markdown')
  @UseGuards(AccessControlGuard)
  @SetMetadata('aclCheck', { type: 'wiki', idParam: 'id' })
  async exportWikiToMarkdown(
    @Param('id', ParseIntPipe) id: number,
    @User() user: UserData | null,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const markdown = await this.exportService.exportWikiToMarkdown(id, user);

      const filename = await this.getWikiFilename(id, 'md');

      res.set({
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': Buffer.byteLength(markdown, 'utf8'),
      });

      res.status(HttpStatus.OK).send(markdown);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Export a section as PDF
   */
  @Get('sections/:id/export/pdf')
  @UseGuards(AccessControlGuard)
  @SetMetadata('aclCheck', { type: 'section', idParam: 'id' })
  async exportSectionToPdf(
    @Param('id', ParseIntPipe) id: number,
    @User() user: UserData | null,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const pdfBuffer = await this.exportService.exportSectionToPdf(id, user);

      const filename = await this.getSectionFilename(id, 'pdf');

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length,
      });

      res.status(HttpStatus.OK).send(pdfBuffer);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Export a section as Markdown
   */
  @Get('sections/:id/export/markdown')
  @UseGuards(AccessControlGuard)
  @SetMetadata('aclCheck', { type: 'section', idParam: 'id' })
  async exportSectionToMarkdown(
    @Param('id', ParseIntPipe) id: number,
    @User() user: UserData | null,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const markdown = await this.exportService.exportSectionToMarkdown(id, user);

      const filename = await this.getSectionFilename(id, 'md');

      res.set({
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': Buffer.byteLength(markdown, 'utf8'),
      });

      res.status(HttpStatus.OK).send(markdown);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Helper to get page filename
   */
  private async getPageFilename(id: number, extension: string): Promise<string> {
    // Filename will be sanitized slug
    return `page-${id}.${extension}`;
  }

  /**
   * Helper to get wiki filename
   */
  private async getWikiFilename(id: number, extension: string): Promise<string> {
    return `wiki-${id}.${extension}`;
  }

  /**
   * Helper to get section filename
   */
  private async getSectionFilename(id: number, extension: string): Promise<string> {
    return `section-${id}.${extension}`;
  }
}
