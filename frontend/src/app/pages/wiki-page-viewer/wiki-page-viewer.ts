import { Component, OnInit, OnDestroy, AfterViewChecked } from '@angular/core';
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
export class WikiPageViewer implements OnInit, OnDestroy, AfterViewChecked {
  page$!: Observable<Page>;
  error: string | null = null;

  // Track script elements for cleanup
  private scriptElements: HTMLScriptElement[] = [];

  // Track which page we've executed scripts for (prevents re-execution)
  private lastExecutedPageId: number | null = null;
  private currentPage: Page | null = null;

  constructor(
    private route: ActivatedRoute,
    private wikiService: WikiService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.page$ = this.route.params.pipe(
      tap(params => {
        console.log('Route params changed:', params);
        this.error = null;
        this.cleanupScripts();
        this.lastExecutedPageId = null; // Reset on navigation
        this.currentPage = null;
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
          tap(page => {
            console.log('Page response:', page);
            this.currentPage = page; // Store for AfterViewChecked
          }),
          catchError(err => {
            console.error('Page load error:', err);
            this.error = err.error?.message || 'Failed to load page';
            this.currentPage = null;
            return EMPTY;
          })
        );
      }),
      shareReplay(1)
    );
  }

  ngAfterViewChecked(): void {
    // Execute scripts only once per page, AFTER view has rendered
    if (
      this.currentPage &&
      this.currentPage.allow_scripts &&
      this.currentPage.scripts &&
      this.lastExecutedPageId !== this.currentPage.id
    ) {
      console.log('View rendered, executing scripts for page:', this.currentPage.id);
      this.executeScripts(this.currentPage.scripts);
      this.lastExecutedPageId = this.currentPage.id;
    }
  }

  ngOnDestroy(): void {
    this.cleanupScripts();
  }

  /**
   * Execute custom JavaScript for the page
   */
  private executeScripts(scripts: string): void {
    try {
      console.log('Executing page scripts');

      const scriptEl = document.createElement('script');
      scriptEl.type = 'text/javascript';
      scriptEl.textContent = scripts;

      // Append to body to execute
      document.body.appendChild(scriptEl);

      // Track for cleanup
      this.scriptElements.push(scriptEl);
    } catch (error) {
      console.error('Script execution error:', error);
    }
  }

  /**
   * Clean up all script elements created by this component
   */
  private cleanupScripts(): void {
    this.scriptElements.forEach(scriptEl => {
      try {
        scriptEl.remove();
      } catch (error) {
        console.error('Script cleanup error:', error);
      }
    });

    this.scriptElements = [];
  }

  sanitizeHtml(html: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }
}
