import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { WikiService } from '../../core/services/wiki.service';
import { Page } from '../../core/models/wiki.model';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-wiki-page-viewer',
  imports: [CommonModule],
  templateUrl: './wiki-page-viewer.html',
  styleUrl: './wiki-page-viewer.css'
})
export class WikiPageViewer implements OnInit, OnDestroy {
  page: Page | null = null;
  loading = true;
  error = '';
  private routeSubscription?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private wikiService: WikiService,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.routeSubscription = this.route.params.subscribe(params => {
      const wikiSlug = params['wikiSlug'];
      const sectionSlug = params['sectionSlug'];
      const pageSlug = params['pageSlug'];

      console.log('Route params changed:', { wikiSlug, sectionSlug, pageSlug });
      this.loadPage(wikiSlug, sectionSlug, pageSlug);
    });
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
  }

  loadPage(wikiSlug: string, sectionSlug: string | undefined, pageSlug: string): void {
    this.loading = true;
    this.error = '';

    console.log('Loading page:', { wikiSlug, sectionSlug, pageSlug });

    const request = sectionSlug
      ? this.wikiService.getPagesBySlugs(wikiSlug, sectionSlug, pageSlug)
      : this.wikiService.getPageBySlug(wikiSlug, pageSlug);

    request.subscribe({
      next: (response) => {
        console.log('Page response:', response);

        // Backend returns raw object, not wrapped in { data: ... }
        this.page = response;
        this.loading = false;

        console.log('Page set, triggering change detection');
        // Manually trigger change detection to ensure view updates
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Page load error:', err);
        this.error = err.error?.message || 'Failed to load page';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  sanitizeHtml(html: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }
}
