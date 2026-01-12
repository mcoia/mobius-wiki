import { Injectable } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { Section } from '../models/wiki.model';

interface SectionWithPages extends Section {
  pages?: Array<{
    id: number;
    title: string;
    slug: string;
    status: string;
  }>;
}

@Injectable({
  providedIn: 'root'
})
export class SectionService {
  constructor(private api: ApiService) {}

  getSectionsByWikiId(wikiId: number): Observable<SectionWithPages[]> {
    return this.api.get(`/wikis/${wikiId}/sections`).pipe(
      map((response: any) => response.data || []),
      switchMap((sections: Section[]) => {
        if (sections.length === 0) {
          return of([]);
        }

        // Fetch pages for each section
        const sectionWithPagesRequests = sections.map(section =>
          this.api.get(`/sections/${section.id}/pages`).pipe(
            map((pagesResponse: any) => ({
              ...section,
              pages: pagesResponse.data || []
            }))
          )
        );

        return forkJoin(sectionWithPagesRequests);
      })
    );
  }

  getPagesBySectionId(sectionId: number): Observable<any[]> {
    return this.api.get(`/sections/${sectionId}/pages`).pipe(
      map((response: any) => response.data || [])
    );
  }
}
