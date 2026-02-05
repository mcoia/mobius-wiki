import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface SearchResult {
  id: number;
  title: string;
  slug: string;
  status: string;
  excerpt: string;
  section: {
    id: number;
    title: string;
    slug: string;
  };
  wiki: {
    id: number;
    title: string;
    slug: string;
  };
  rank: number;
  createdAt: string;
  updatedAt: string;
}

export interface SearchMeta {
  total: number;
  limit: number;
  offset: number;
  query: string;
  hasMore: boolean;
}

export interface SearchResponse {
  data: SearchResult[];
  meta: SearchMeta;
}

export interface SearchParams {
  q: string;
  limit?: number;
  offset?: number;
  wikiId?: number;
  sectionId?: number;
}

@Injectable({
  providedIn: 'root'
})
export class SearchService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /**
   * Search for pages across the wiki
   */
  search(params: SearchParams): Observable<SearchResponse> {
    let httpParams = new HttpParams().set('q', params.q);

    if (params.limit !== undefined) {
      httpParams = httpParams.set('limit', params.limit.toString());
    }

    if (params.offset !== undefined) {
      httpParams = httpParams.set('offset', params.offset.toString());
    }

    if (params.wikiId !== undefined) {
      httpParams = httpParams.set('wikiId', params.wikiId.toString());
    }

    if (params.sectionId !== undefined) {
      httpParams = httpParams.set('sectionId', params.sectionId.toString());
    }

    return this.http.get<SearchResponse>(`${this.apiUrl}/search`, { params: httpParams });
  }
}
