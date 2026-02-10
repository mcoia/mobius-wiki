import { Injectable, Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Pool } from 'pg';
import * as puppeteer from 'puppeteer';
import TurndownService from 'turndown';
import * as path from 'path';
import * as fs from 'fs';
import { AccessControlService } from '../access-control/access-control.service';
import { FilesService } from '../files/files.service';

interface User {
  id: number;
  role?: string;
  libraryId?: number | null;
}

interface PageData {
  id: number;
  title: string;
  slug: string;
  content: string;
  status: string;
  wiki?: { title: string; slug: string };
  section?: { title: string; slug: string };
  updated_at: Date;
  author?: { name: string };
}

@Injectable()
export class ExportService {
  private turndownService: TurndownService;
  private pdfTemplate: string;

  constructor(
    @Inject('DATABASE_POOL') private pool: Pool,
    private aclService: AccessControlService,
    private filesService: FilesService,
  ) {
    // Initialize Turndown for HTML -> Markdown conversion
    this.turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      bulletListMarker: '-',
    });

    // Add rules for better markdown conversion
    this.turndownService.addRule('codeBlocks', {
      filter: ['pre'],
      replacement: (content, node) => {
        const codeNode = node.querySelector('code');
        const language = codeNode?.className?.replace('language-', '') || '';
        return '\n```' + language + '\n' + content.trim() + '\n```\n';
      },
    });

    // Load PDF template
    const templatePath = path.join(__dirname, 'templates', 'pdf-template.html');
    try {
      this.pdfTemplate = fs.readFileSync(templatePath, 'utf-8');
    } catch {
      // Fallback template if file doesn't exist
      this.pdfTemplate = this.getDefaultPdfTemplate();
    }
  }

  /**
   * Export a single page to PDF
   */
  async exportPageToPdf(pageId: number, user: User | null): Promise<Buffer> {
    const page = await this.getPageWithAccessCheck(pageId, user);
    const html = await this.generatePdfHtml(page);
    return this.htmlToPdf(html);
  }

  /**
   * Export a single page to Markdown
   */
  async exportPageToMarkdown(pageId: number, user: User | null): Promise<string> {
    const page = await this.getPageWithAccessCheck(pageId, user);
    return this.generateMarkdown(page);
  }

  /**
   * Export an entire wiki to PDF
   */
  async exportWikiToPdf(wikiId: number, user: User | null): Promise<Buffer> {
    const pages = await this.getWikiPagesWithAccessCheck(wikiId, user);
    const wiki = await this.getWiki(wikiId);

    const combinedHtml = await this.generateMultiPagePdfHtml(pages, wiki.title);
    return this.htmlToPdf(combinedHtml);
  }

  /**
   * Export an entire wiki to Markdown
   */
  async exportWikiToMarkdown(wikiId: number, user: User | null): Promise<string> {
    const pages = await this.getWikiPagesWithAccessCheck(wikiId, user);
    const wiki = await this.getWiki(wikiId);

    return this.generateMultiPageMarkdown(pages, wiki.title);
  }

  /**
   * Export a section to PDF
   */
  async exportSectionToPdf(sectionId: number, user: User | null): Promise<Buffer> {
    const pages = await this.getSectionPagesWithAccessCheck(sectionId, user);
    const section = await this.getSection(sectionId);

    const combinedHtml = await this.generateMultiPagePdfHtml(pages, section.title);
    return this.htmlToPdf(combinedHtml);
  }

  /**
   * Export a section to Markdown
   */
  async exportSectionToMarkdown(sectionId: number, user: User | null): Promise<string> {
    const pages = await this.getSectionPagesWithAccessCheck(sectionId, user);
    const section = await this.getSection(sectionId);

    return this.generateMultiPageMarkdown(pages, section.title);
  }

  /**
   * Get page data with access control check
   */
  private async getPageWithAccessCheck(pageId: number, user: User | null): Promise<PageData> {
    // Check access
    const hasAccess = await this.aclService.canAccess(user, 'page', pageId);
    if (!hasAccess) {
      throw new ForbiddenException('Access denied');
    }

    const query = `
      SELECT
        p.id, p.title, p.slug, p.content, p.status, p.updated_at,
        p.published_version_number,
        json_build_object('title', w.title, 'slug', w.slug) as wiki,
        json_build_object('title', s.title, 'slug', s.slug) as section,
        json_build_object('name', u.name) as author
      FROM wiki.pages p
      JOIN wiki.sections s ON p.section_id = s.id
      JOIN wiki.wikis w ON s.wiki_id = w.id
      LEFT JOIN wiki.users u ON p.created_by = u.id
      WHERE p.id = $1 AND p.deleted_at IS NULL
    `;

    const { rows } = await this.pool.query(query, [pageId]);
    if (rows.length === 0) {
      throw new NotFoundException(`Page with ID ${pageId} not found`);
    }

    const page = rows[0];

    // If page is draft and user is not an editor, get published version
    if (page.status === 'draft' && page.published_version_number) {
      const canEdit = await this.aclService.canEdit(user, 'page', pageId);
      if (!canEdit) {
        const { rows: versionRows } = await this.pool.query(
          'SELECT content, title FROM wiki.page_versions WHERE page_id = $1 AND version_number = $2',
          [pageId, page.published_version_number]
        );
        if (versionRows.length > 0) {
          page.content = versionRows[0].content;
          page.title = versionRows[0].title;
        }
      }
    }

    return page;
  }

  /**
   * Get all pages in a wiki with access check
   */
  private async getWikiPagesWithAccessCheck(wikiId: number, user: User | null): Promise<PageData[]> {
    // Check wiki access
    const hasAccess = await this.aclService.canAccess(user, 'wiki', wikiId);
    if (!hasAccess) {
      throw new ForbiddenException('Access denied');
    }

    const query = `
      SELECT
        p.id, p.title, p.slug, p.content, p.status, p.updated_at,
        p.published_version_number,
        json_build_object('title', s.title, 'slug', s.slug) as section,
        json_build_object('name', u.name) as author
      FROM wiki.pages p
      JOIN wiki.sections s ON p.section_id = s.id
      LEFT JOIN wiki.users u ON p.created_by = u.id
      WHERE s.wiki_id = $1
        AND p.deleted_at IS NULL
        AND s.deleted_at IS NULL
      ORDER BY s.sort_order, s.title, p.sort_order, p.title
    `;

    const { rows } = await this.pool.query(query, [wikiId]);

    // Filter by page-level ACL and get visible content
    const accessiblePages: PageData[] = [];
    for (const page of rows) {
      const pageHasAccess = await this.aclService.canAccess(user, 'page', page.id);
      if (pageHasAccess) {
        // Handle draft pages
        if (page.status === 'draft') {
          const canEdit = await this.aclService.canEdit(user, 'page', page.id);
          if (!canEdit) {
            // Non-editor: skip if never published, or show published version
            if (!page.published_version_number) continue;
            const { rows: versionRows } = await this.pool.query(
              'SELECT content, title FROM wiki.page_versions WHERE page_id = $1 AND version_number = $2',
              [page.id, page.published_version_number]
            );
            if (versionRows.length > 0) {
              page.content = versionRows[0].content;
              page.title = versionRows[0].title;
            }
          }
        }
        accessiblePages.push(page);
      }
    }

    return accessiblePages;
  }

  /**
   * Get all pages in a section with access check
   */
  private async getSectionPagesWithAccessCheck(sectionId: number, user: User | null): Promise<PageData[]> {
    // Check section access
    const hasAccess = await this.aclService.canAccess(user, 'section', sectionId);
    if (!hasAccess) {
      throw new ForbiddenException('Access denied');
    }

    const query = `
      SELECT
        p.id, p.title, p.slug, p.content, p.status, p.updated_at,
        p.published_version_number,
        json_build_object('name', u.name) as author
      FROM wiki.pages p
      LEFT JOIN wiki.users u ON p.created_by = u.id
      WHERE p.section_id = $1
        AND p.deleted_at IS NULL
      ORDER BY p.sort_order, p.title
    `;

    const { rows } = await this.pool.query(query, [sectionId]);

    // Filter by page-level ACL
    const accessiblePages: PageData[] = [];
    for (const page of rows) {
      const pageHasAccess = await this.aclService.canAccess(user, 'page', page.id);
      if (pageHasAccess) {
        if (page.status === 'draft') {
          const canEdit = await this.aclService.canEdit(user, 'page', page.id);
          if (!canEdit) {
            if (!page.published_version_number) continue;
            const { rows: versionRows } = await this.pool.query(
              'SELECT content, title FROM wiki.page_versions WHERE page_id = $1 AND version_number = $2',
              [page.id, page.published_version_number]
            );
            if (versionRows.length > 0) {
              page.content = versionRows[0].content;
              page.title = versionRows[0].title;
            }
          }
        }
        accessiblePages.push(page);
      }
    }

    return accessiblePages;
  }

  /**
   * Get wiki info
   */
  private async getWiki(wikiId: number): Promise<{ title: string; slug: string }> {
    const { rows } = await this.pool.query(
      'SELECT title, slug FROM wiki.wikis WHERE id = $1 AND deleted_at IS NULL',
      [wikiId]
    );
    if (rows.length === 0) {
      throw new NotFoundException(`Wiki with ID ${wikiId} not found`);
    }
    return rows[0];
  }

  /**
   * Get section info
   */
  private async getSection(sectionId: number): Promise<{ title: string; slug: string }> {
    const { rows } = await this.pool.query(
      'SELECT title, slug FROM wiki.sections WHERE id = $1 AND deleted_at IS NULL',
      [sectionId]
    );
    if (rows.length === 0) {
      throw new NotFoundException(`Section with ID ${sectionId} not found`);
    }
    return rows[0];
  }

  /**
   * Generate HTML for PDF from a single page
   */
  private async generatePdfHtml(page: PageData): Promise<string> {
    const exportDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const breadcrumb = [
      page.wiki?.title,
      page.section?.title,
      page.title,
    ].filter(Boolean).join(' › ');

    // Process images - convert to base64 data URIs
    const processedContent = await this.processContentImages(page.content || '');

    return this.pdfTemplate
      .replaceAll('{{title}}', this.escapeHtml(page.title))
      .replaceAll('{{breadcrumb}}', this.escapeHtml(breadcrumb))
      .replaceAll('{{exportDate}}', exportDate)
      .replaceAll('{{content}}', processedContent)
      .replaceAll('{{author}}', this.escapeHtml(page.author?.name || 'Unknown'))
      .replaceAll('{{updatedAt}}', page.updated_at ? new Date(page.updated_at).toLocaleDateString() : '');
  }

  /**
   * Generate HTML for PDF from multiple pages
   */
  private async generateMultiPagePdfHtml(pages: PageData[], collectionTitle: string): Promise<string> {
    const exportDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // Generate table of contents
    let toc = '<div class="toc"><h2>Table of Contents</h2><ul>';
    let currentSection = '';

    pages.forEach((page, index) => {
      const sectionTitle = page.section?.title || '';
      if (sectionTitle !== currentSection) {
        if (currentSection) toc += '</ul></li>';
        toc += `<li><strong>${this.escapeHtml(sectionTitle)}</strong><ul>`;
        currentSection = sectionTitle;
      }
      toc += `<li><a href="#page-${index}">${this.escapeHtml(page.title)}</a></li>`;
    });
    if (currentSection) toc += '</ul></li>';
    toc += '</ul></div>';

    // Generate content for each page (process images sequentially to avoid memory issues)
    let pagesContent = '';
    for (let index = 0; index < pages.length; index++) {
      const page = pages[index];
      const processedContent = await this.processContentImages(page.content || '');
      pagesContent += `
        <div class="page-section" id="page-${index}">
          <h1 class="page-title">${this.escapeHtml(page.title)}</h1>
          ${page.section ? `<p class="page-section-name">Section: ${this.escapeHtml(page.section.title)}</p>` : ''}
          <div class="page-content">${processedContent}</div>
        </div>
        <div class="page-break"></div>
      `;
    }

    return this.pdfTemplate
      .replaceAll('{{title}}', this.escapeHtml(collectionTitle))
      .replaceAll('{{breadcrumb}}', this.escapeHtml(collectionTitle))
      .replaceAll('{{exportDate}}', exportDate)
      .replaceAll('{{content}}', toc + pagesContent)
      .replaceAll('{{author}}', '')
      .replaceAll('{{updatedAt}}', '');
  }

  /**
   * Generate Markdown for a single page
   */
  private generateMarkdown(page: PageData): string {
    // YAML frontmatter
    const frontmatter = [
      '---',
      `title: "${this.escapeYaml(page.title)}"`,
      `slug: "${page.slug}"`,
      page.wiki ? `wiki: "${this.escapeYaml(page.wiki.title)}"` : null,
      page.section ? `section: "${this.escapeYaml(page.section.title)}"` : null,
      page.author?.name ? `author: "${this.escapeYaml(page.author.name)}"` : null,
      `exported: "${new Date().toISOString()}"`,
      `updated: "${page.updated_at ? new Date(page.updated_at).toISOString() : ''}"`,
      '---',
      '',
    ].filter(line => line !== null).join('\n');

    // Convert HTML to Markdown
    const markdown = this.turndownService.turndown(page.content || '');

    return frontmatter + `# ${page.title}\n\n` + markdown;
  }

  /**
   * Generate Markdown for multiple pages
   */
  private generateMultiPageMarkdown(pages: PageData[], collectionTitle: string): string {
    const frontmatter = [
      '---',
      `title: "${this.escapeYaml(collectionTitle)}"`,
      `exported: "${new Date().toISOString()}"`,
      `pages: ${pages.length}`,
      '---',
      '',
    ].join('\n');

    // Table of contents
    let toc = '## Table of Contents\n\n';
    let currentSection = '';

    pages.forEach((page) => {
      const sectionTitle = page.section?.title || '';
      if (sectionTitle !== currentSection) {
        toc += `\n### ${sectionTitle}\n\n`;
        currentSection = sectionTitle;
      }
      const anchor = page.title.toLowerCase().replace(/[^\w]+/g, '-');
      toc += `- [${page.title}](#${anchor})\n`;
    });

    // Page content
    let content = '';
    pages.forEach(page => {
      const markdown = this.turndownService.turndown(page.content || '');
      content += `\n---\n\n# ${page.title}\n\n`;
      if (page.section) {
        content += `*Section: ${page.section.title}*\n\n`;
      }
      content += markdown + '\n';
    });

    return frontmatter + `# ${collectionTitle}\n\n` + toc + content;
  }

  /**
   * Convert HTML to PDF using Puppeteer
   */
  private async htmlToPdf(html: string): Promise<Buffer> {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        margin: {
          top: '20mm',
          right: '20mm',
          bottom: '20mm',
          left: '20mm',
        },
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: '<div></div>',
        footerTemplate: `
          <div style="width: 100%; font-size: 10px; padding: 0 20mm; color: #666; display: flex; justify-content: space-between;">
            <span>MOBIUS Wiki</span>
            <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
          </div>
        `,
      });

      return Buffer.from(pdfBuffer);
    } finally {
      await browser.close();
    }
  }

  /**
   * Process content images - convert relative URLs to base64 data URIs
   * This ensures images are embedded in the PDF since Puppeteer can't
   * resolve relative URLs when HTML is loaded from a string.
   */
  private async processContentImages(content: string): Promise<string> {
    // Find all image URLs matching /api/v1/files/{id}/download
    const imageRegex = /src="\/api\/v1\/files\/(\d+)\/download"/g;
    const matches: { fullMatch: string; fileId: number }[] = [];

    let match: RegExpExecArray | null;
    while ((match = imageRegex.exec(content)) !== null) {
      matches.push({
        fullMatch: match[0],
        fileId: parseInt(match[1], 10),
      });
    }

    // Convert each image to base64 data URI
    let processedContent = content;
    for (const { fullMatch, fileId } of matches) {
      try {
        // Get file metadata for MIME type
        const file = await this.filesService.findOne(fileId);
        // Get file binary data
        const buffer = await this.filesService.getFileBuffer(fileId);
        // Convert to base64 data URI
        const base64 = buffer.toString('base64');
        const dataUri = `data:${file.mime_type};base64,${base64}`;
        // Replace in content
        processedContent = processedContent.replace(fullMatch, `src="${dataUri}"`);
      } catch (error) {
        // If file not found or error, leave as-is (will show broken image)
        console.warn(`Failed to embed image file ${fileId}:`, error.message);
      }
    }

    return processedContent;
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Escape YAML special characters
   */
  private escapeYaml(str: string): string {
    return str.replace(/"/g, '\\"').replace(/\n/g, '\\n');
  }

  /**
   * Default PDF template if file doesn't exist
   */
  private getDefaultPdfTemplate(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{title}}</title>
  <style>
    * {
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 100%;
      margin: 0;
      padding: 0;
    }

    .header {
      border-bottom: 2px solid #0097A7;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }

    .header h1 {
      margin: 0 0 8px 0;
      color: #1a2a3a;
      font-size: 28px;
    }

    .breadcrumb {
      color: #666;
      font-size: 14px;
      margin-bottom: 4px;
    }

    .export-date {
      color: #999;
      font-size: 12px;
    }

    .content {
      margin-top: 24px;
    }

    .content h1 { font-size: 24px; margin-top: 32px; }
    .content h2 { font-size: 20px; margin-top: 28px; }
    .content h3 { font-size: 18px; margin-top: 24px; }
    .content h4 { font-size: 16px; margin-top: 20px; }

    .content p {
      margin: 12px 0;
    }

    .content ul, .content ol {
      margin: 12px 0;
      padding-left: 24px;
    }

    .content li {
      margin: 6px 0;
    }

    .content pre {
      background: #f5f5f5;
      padding: 16px;
      border-radius: 4px;
      overflow-x: auto;
      font-size: 13px;
      line-height: 1.5;
    }

    .content code {
      font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
      background: #f0f0f0;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 0.9em;
    }

    .content pre code {
      background: none;
      padding: 0;
    }

    .content img {
      max-width: 100%;
      height: auto;
    }

    .content table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
    }

    .content th, .content td {
      border: 1px solid #ddd;
      padding: 10px 12px;
      text-align: left;
    }

    .content th {
      background: #f5f5f5;
      font-weight: 600;
    }

    .content blockquote {
      border-left: 4px solid #0097A7;
      margin: 16px 0;
      padding: 12px 20px;
      background: #f9fafb;
      color: #555;
    }

    .content a {
      color: #0097A7;
      text-decoration: none;
    }

    .toc {
      background: #f9fafb;
      padding: 20px;
      border-radius: 6px;
      margin-bottom: 32px;
    }

    .toc h2 {
      margin-top: 0;
      font-size: 18px;
    }

    .toc ul {
      margin: 8px 0;
      padding-left: 20px;
    }

    .toc li {
      margin: 4px 0;
    }

    .toc a {
      color: #0097A7;
      text-decoration: none;
    }

    .page-section {
      margin-top: 48px;
    }

    .page-section:first-of-type {
      margin-top: 0;
    }

    .page-title {
      border-bottom: 1px solid #e0e0e0;
      padding-bottom: 12px;
    }

    .page-section-name {
      color: #666;
      font-style: italic;
      margin-top: -8px;
    }

    .page-break {
      page-break-after: always;
    }

    .footer {
      margin-top: 48px;
      padding-top: 16px;
      border-top: 1px solid #e0e0e0;
      color: #999;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="breadcrumb">{{breadcrumb}}</div>
    <h1>{{title}}</h1>
    <div class="export-date">Exported on {{exportDate}}</div>
  </div>

  <div class="content">
    {{content}}
  </div>

  <div class="footer">
    <p>Generated by MOBIUS Wiki</p>
  </div>
</body>
</html>`;
  }
}
