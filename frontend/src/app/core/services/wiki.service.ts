import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Wiki, Page } from '../models/wiki.model';

@Injectable({
  providedIn: 'root'
})
export class WikiService {
  constructor(private api: ApiService) {}

  getWikiBySlug(slug: string): Observable<any> {
    return this.api.get(`/wikis/slug/${slug}`);
  }

  getPageBySlug(wikiSlug: string, pageSlug: string): Observable<any> {
    return this.api.get(`/wikis/slug/${wikiSlug}/pages/slug/${pageSlug}`);
  }

  getPagesBySlugs(wikiSlug: string, sectionSlug: string, pageSlug: string): Observable<any> {
    return this.api.get(`/wikis/slug/${wikiSlug}/sections/slug/${sectionSlug}/pages/slug/${pageSlug}`);
  }

  getWikis(): Observable<{ data: Wiki[]; meta: { total: number } }> {
    return this.api.get('/wikis');
  }
}
