import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Wiki, Section, Page, PageVersion } from '../models/wiki.model';

@Injectable({
  providedIn: 'root'
})
export class WikiService {
  constructor(private api: ApiService) {}

  getWikiBySlug(slug: string): Observable<{ data: Wiki }> {
    return this.api.get(`/wikis/slug/${slug}`);
  }

  getPageBySlug(wikiSlug: string, pageSlug: string, viewPublished = false): Observable<{ data: Page }> {
    const params = viewPublished ? '?viewPublished=true' : '';
    return this.api.get(`/wikis/slug/${wikiSlug}/pages/slug/${pageSlug}${params}`);
  }

  getPagesBySlugs(wikiSlug: string, sectionSlug: string, pageSlug: string, viewPublished = false): Observable<{ data: Page }> {
    const params = viewPublished ? '?viewPublished=true' : '';
    return this.api.get(`/wikis/slug/${wikiSlug}/sections/slug/${sectionSlug}/pages/slug/${pageSlug}${params}`);
  }

  getWikis(): Observable<{ data: Wiki[]; meta: { total: number } }> {
    return this.api.get('/wikis');
  }

  updatePage(pageId: number, data: { content: string; expectedVersion?: number }): Observable<{ data: Page }> {
    return this.api.patch(`/pages/${pageId}`, data);
  }

  // Wiki CRUD operations
  createWiki(data: { title: string; slug?: string; description?: string }): Observable<{ data: Wiki }> {
    return this.api.post('/wikis', data);
  }

  updateWiki(id: number, data: Partial<Wiki>): Observable<{ data: Wiki }> {
    return this.api.patch(`/wikis/${id}`, data);
  }

  deleteWiki(id: number): Observable<{ data: null }> {
    return this.api.delete(`/wikis/${id}`);
  }

  // Section CRUD operations
  getSectionsByWikiId(wikiId: number): Observable<{ data: Section[] }> {
    return this.api.get(`/wikis/${wikiId}/sections`);
  }

  createSection(wikiId: number, data: { title: string; slug?: string; description?: string }): Observable<{ data: Section }> {
    return this.api.post(`/wikis/${wikiId}/sections`, data);
  }

  updateSection(id: number, data: Partial<Section>): Observable<{ data: Section }> {
    return this.api.patch(`/sections/${id}`, data);
  }

  deleteSection(id: number): Observable<{ data: null }> {
    return this.api.delete(`/sections/${id}`);
  }

  // Page CRUD operations
  createPage(sectionId: number, data: { title: string; slug?: string; content?: string }): Observable<{ data: Page }> {
    return this.api.post(`/sections/${sectionId}/pages`, data);
  }

  deletePage(id: number): Observable<{ data: null }> {
    return this.api.delete(`/pages/${id}`);
  }

  movePage(pageId: number, targetSectionId: number): Observable<{ data: Page }> {
    return this.api.patch(`/pages/${pageId}`, { sectionId: targetSectionId });
  }

  // Publish page
  publishPage(id: number): Observable<{ data: Page }> {
    return this.api.post(`/pages/${id}/publish`, {});
  }

  // Discard draft and revert to published version
  discardDraft(id: number): Observable<{ data: Page }> {
    return this.api.post(`/pages/${id}/discard-draft`, {});
  }

  // Version history methods
  getPageVersions(pageId: number): Observable<{ data: PageVersion[]; meta: { total: number } }> {
    return this.api.get(`/pages/${pageId}/versions`);
  }

  getPageVersion(pageId: number, versionNumber: number): Observable<PageVersion> {
    return this.api.get(`/pages/${pageId}/versions/${versionNumber}`);
  }

  restoreVersion(pageId: number, versionNumber: number): Observable<{ data: Page }> {
    return this.api.post(`/pages/${pageId}/restore/${versionNumber}`, {});
  }
}
