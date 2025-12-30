import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { WikiService } from '../../core/services/wiki.service';
import { Page } from '../../core/models/wiki.model';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Observable, throwError, EMPTY } from 'rxjs';
import { switchMap, catchError, shareReplay, tap } from 'rxjs/operators';

@Component({
  selector: 'app-wiki-page-viewer',
  imports: [CommonModule],
  templateUrl: './wiki-page-viewer.html',
  styleUrl: './wiki-page-viewer.css'
})
export class WikiPageViewer implements OnInit {
  page$!: Observable<Page>;
  error: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private wikiService: WikiService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.page$ = this.route.params.pipe(
      tap(params => {
        console.log('Route params changed:', params);
        this.error = null; // Reset error on navigation
      }),
      switchMap(params => {
        const wikiSlug = params['wikiSlug'];
        const sectionSlug = params['sectionSlug'];
        const pageSlug = params['pageSlug'];

        console.log('Loading page:', { wikiSlug, sectionSlug, pageSlug });

        const request = sectionSlug
          ? this.wikiService.getPagesBySlugs(wikiSlug, sectionSlug, pageSlug)
          : this.wikiService.getPageBySlug(wikiSlug, pageSlug);

        return request.pipe(
          tap(response => {
            console.log('Page response:', response);
          }),
          catchError(err => {
            console.error('Page load error:', err);
            this.error = err.error?.message || 'Failed to load page';
            return EMPTY; // Return empty observable on error
          })
        );
      }),
      shareReplay(1)
    );
  }

  sanitizeHtml(html: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }
}
