import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Observable, EMPTY } from 'rxjs';
import { map, switchMap, shareReplay, catchError, take, tap } from 'rxjs/operators';
import { WikiService } from '../../core/services/wiki.service';
import { SectionService } from '../../core/services/section.service';
import { AuthService } from '../../core/services/auth.service';
import { Wiki, Section } from '../../core/models/wiki.model';
import { CreateModalComponent } from '../../shared/components/create-modal/create-modal.component';

interface SectionWithPages extends Section {
  pages?: Array<{
    id: number;
    title: string;
    slug: string;
    status: string;
  }>;
}

@Component({
  selector: 'app-wiki-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, CreateModalComponent],
  templateUrl: './wiki-detail.component.html',
  styleUrls: ['./wiki-detail.component.css']
})
export class WikiDetailComponent implements OnInit {
  wiki$!: Observable<Wiki>;
  sections$!: Observable<SectionWithPages[]>;
  canEdit$!: Observable<boolean>;
  error: string | null = null;

  showCreateSectionModal = false;
  @ViewChild('createSectionModal') createSectionModal?: CreateModalComponent;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private wikiService: WikiService,
    private sectionService: SectionService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    const wikiSlug$ = this.route.params.pipe(
      map(params => params['wikiSlug'])
    );

    // Load wiki data
    this.wiki$ = wikiSlug$.pipe(
      switchMap(slug => this.wikiService.getWikiBySlug(slug)),
      map(response => response.data), // Unwrap response
      catchError(error => {
        console.error('Failed to load wiki:', error);
        this.error = error.error?.message || 'Failed to load wiki';
        return EMPTY;
      }),
      shareReplay(1)
    );

    // Load sections with pages
    this.sections$ = this.wiki$.pipe(
      switchMap((wiki: any) => this.sectionService.getSectionsByWikiId(wiki.id)),
      catchError(error => {
        console.error('Failed to load sections:', error);
        return EMPTY;
      }),
      tap((sections: SectionWithPages[]) => {
        // Check if user explicitly wants to see overview
        this.route.queryParams.pipe(take(1)).subscribe(params => {
          const showOverview = params['view'] === 'overview';
          if (!showOverview) {
            // Auto-redirect to first page for consistent UX
            this.redirectToDefaultPage(sections);
          }
        });
      }),
      shareReplay(1)
    );

    // Permission check
    this.canEdit$ = this.authService.currentUser$.pipe(
      map(user => {
        if (!user) return false;
        return user.role === 'site_admin' || user.role === 'mobius_staff';
      }),
      shareReplay(1)
    );
  }

  /**
   * Redirect to the first available page in the wiki
   * Provides consistent UX - clicking wiki name goes to content, not index
   */
  private redirectToDefaultPage(sections: SectionWithPages[]): void {
    // Find first section with pages
    for (const section of sections) {
      if (section.pages && section.pages.length > 0) {
        // Get first published page, or first draft if no published pages
        const firstPage = section.pages.find(p => p.status === 'published') || section.pages[0];

        // Get current wiki slug from route
        this.route.params.pipe(take(1)).subscribe(params => {
          const wikiSlug = params['wikiSlug'];

          console.log(`Auto-redirecting to: /wiki/${wikiSlug}/${section.slug}/${firstPage.slug}`);

          // Redirect to first page
          this.router.navigate(
            ['/wiki', wikiSlug, section.slug, firstPage.slug],
            { replaceUrl: true }  // Replace history so back button works correctly
          );
        });

        return; // Exit after first redirect
      }
    }

    // If no pages exist, stay on overview (fallback for empty wikis)
    console.log('No pages found in wiki, showing overview');
  }

  onCreateSection(data: { title: string; slug: string; description: string }): void {
    if (this.createSectionModal) {
      this.createSectionModal.setLoading(true);
      this.createSectionModal.setError('');
    }

    this.wiki$.pipe(
      take(1),
      switchMap((wiki: any) => {
        return this.wikiService.createSection(wiki.id, {
          title: data.title,
          slug: data.slug,
          description: data.description
        });
      })
    ).subscribe({
      next: () => {
        this.showCreateSectionModal = false;
        // Reload page to show new section
        window.location.reload();
      },
      error: (error: any) => {
        if (this.createSectionModal) {
          this.createSectionModal.setError(error.error?.message || 'Failed to create section');
          this.createSectionModal.setLoading(false);
        }
      }
    });
  }
}
