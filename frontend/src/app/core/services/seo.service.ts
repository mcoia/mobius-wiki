import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Title, Meta } from '@angular/platform-browser';

export interface SeoMetaData {
  title?: string;
  description?: string;
  ogType?: 'website' | 'article';
  ogImage?: string;
  ogUrl?: string;
  author?: string;
  publishedTime?: string;
  modifiedTime?: string;
}

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export interface ArticleSchemaData {
  title: string;
  description: string;
  url: string;
  datePublished?: string;
  dateModified?: string;
  authorName?: string;
}

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly defaultTitle = 'MOBIUS Wiki';
  private readonly defaultDescription = 'MOBIUS Wiki - Collaborative documentation for MOBIUS Library Consortium';
  private readonly defaultOgImage = '/images/mobius-og-default.svg';
  private jsonLdScriptId = 'json-ld-schema';
  private isBrowser: boolean;

  constructor(
    private titleService: Title,
    private meta: Meta,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  /**
   * Update page meta tags for SEO
   */
  updateMetaTags(data: SeoMetaData): void {
    // Set page title
    const title = data.title
      ? `${data.title} | ${this.defaultTitle}`
      : this.defaultTitle;
    this.titleService.setTitle(title);

    // Description
    const description = data.description || this.defaultDescription;
    this.updateOrCreateMeta('name', 'description', description);

    // Open Graph tags
    this.updateOrCreateMeta('property', 'og:title', data.title || this.defaultTitle);
    this.updateOrCreateMeta('property', 'og:description', description);
    this.updateOrCreateMeta('property', 'og:type', data.ogType || 'website');

    if (data.ogImage) {
      this.updateOrCreateMeta('property', 'og:image', data.ogImage);
    } else {
      this.updateOrCreateMeta('property', 'og:image', this.defaultOgImage);
    }

    if (data.ogUrl) {
      this.updateOrCreateMeta('property', 'og:url', data.ogUrl);
    }

    // Twitter Card tags
    this.updateOrCreateMeta('name', 'twitter:title', data.title || this.defaultTitle);
    this.updateOrCreateMeta('name', 'twitter:description', description);

    if (data.ogImage) {
      this.updateOrCreateMeta('name', 'twitter:image', data.ogImage);
    }

    // Article-specific tags
    if (data.ogType === 'article') {
      if (data.author) {
        this.updateOrCreateMeta('name', 'author', data.author);
        this.updateOrCreateMeta('property', 'article:author', data.author);
      }
      if (data.publishedTime) {
        this.updateOrCreateMeta('property', 'article:published_time', data.publishedTime);
      }
      if (data.modifiedTime) {
        this.updateOrCreateMeta('property', 'article:modified_time', data.modifiedTime);
      }
    }
  }

  /**
   * Set JSON-LD structured data
   */
  setJsonLd(schema: object): void {
    if (!this.isBrowser) return;

    // Remove existing JSON-LD script
    const existingScript = document.getElementById(this.jsonLdScriptId);
    if (existingScript) {
      existingScript.remove();
    }

    // Create new script element
    const script = document.createElement('script');
    script.id = this.jsonLdScriptId;
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);
  }

  /**
   * Generate Article schema for wiki pages
   */
  generateArticleSchema(data: ArticleSchemaData): object {
    const baseUrl = this.getBaseUrl();

    const schema: any = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      'headline': data.title,
      'description': data.description,
      'url': data.url || baseUrl,
      'publisher': {
        '@type': 'Organization',
        'name': 'MOBIUS Library Consortium',
        'logo': {
          '@type': 'ImageObject',
          'url': `${baseUrl}/images/mobius-og-default.svg`
        }
      },
      'mainEntityOfPage': {
        '@type': 'WebPage',
        '@id': data.url || baseUrl
      }
    };

    if (data.datePublished) {
      schema.datePublished = data.datePublished;
    }

    if (data.dateModified) {
      schema.dateModified = data.dateModified;
    }

    if (data.authorName) {
      schema.author = {
        '@type': 'Person',
        'name': data.authorName
      };
    }

    return schema;
  }

  /**
   * Generate BreadcrumbList schema
   */
  generateBreadcrumbSchema(items: BreadcrumbItem[]): object {
    const baseUrl = this.getBaseUrl();

    return {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      'itemListElement': items.map((item, index) => ({
        '@type': 'ListItem',
        'position': index + 1,
        'name': item.name,
        'item': item.url.startsWith('http') ? item.url : `${baseUrl}${item.url}`
      }))
    };
  }

  /**
   * Reset meta tags to defaults (call on component destroy)
   */
  resetToDefaults(): void {
    this.titleService.setTitle(this.defaultTitle);
    this.updateOrCreateMeta('name', 'description', this.defaultDescription);

    // Reset OG tags
    this.updateOrCreateMeta('property', 'og:title', this.defaultTitle);
    this.updateOrCreateMeta('property', 'og:description', this.defaultDescription);
    this.updateOrCreateMeta('property', 'og:type', 'website');
    this.updateOrCreateMeta('property', 'og:image', this.defaultOgImage);

    // Reset Twitter tags
    this.updateOrCreateMeta('name', 'twitter:title', this.defaultTitle);
    this.updateOrCreateMeta('name', 'twitter:description', this.defaultDescription);

    // Remove article-specific tags
    this.meta.removeTag('name="author"');
    this.meta.removeTag('property="article:author"');
    this.meta.removeTag('property="article:published_time"');
    this.meta.removeTag('property="article:modified_time"');

    // Remove JSON-LD
    if (this.isBrowser) {
      const existingScript = document.getElementById(this.jsonLdScriptId);
      if (existingScript) {
        existingScript.remove();
      }
    }
  }

  /**
   * Extract description from HTML content (first 160 characters of text)
   */
  extractDescription(htmlContent: string, maxLength = 160): string {
    if (!htmlContent) return this.defaultDescription;

    // Strip HTML tags
    const tempDiv = this.isBrowser ? document.createElement('div') : null;
    if (tempDiv) {
      tempDiv.innerHTML = htmlContent;
      const text = tempDiv.textContent || tempDiv.innerText || '';
      const cleaned = text.replace(/\s+/g, ' ').trim();
      return cleaned.length > maxLength
        ? cleaned.substring(0, maxLength - 3) + '...'
        : cleaned || this.defaultDescription;
    }

    // Fallback for SSR: simple regex strip
    const text = htmlContent.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    return text.length > maxLength
      ? text.substring(0, maxLength - 3) + '...'
      : text || this.defaultDescription;
  }

  /**
   * Helper to update or create meta tag
   */
  private updateOrCreateMeta(attrSelector: 'name' | 'property', attrValue: string, content: string): void {
    const selector = `${attrSelector}="${attrValue}"`;
    const existingTag = this.meta.getTag(selector);

    if (existingTag) {
      this.meta.updateTag({ [attrSelector]: attrValue, content });
    } else {
      this.meta.addTag({ [attrSelector]: attrValue, content });
    }
  }

  /**
   * Get base URL for the application
   */
  private getBaseUrl(): string {
    if (this.isBrowser) {
      return window.location.origin;
    }
    return 'http://localhost:4200'; // Fallback for SSR
  }
}
