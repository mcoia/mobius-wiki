import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Observable, EMPTY } from 'rxjs';
import { map, switchMap, shareReplay, catchError, take } from 'rxjs/operators';
import { WikiService } from '../../core/services/wiki.service';
import { SectionService } from '../../core/services/section.service';
import { AuthService } from '../../core/services/auth.service';
import { Wiki, Section } from '../../core/models/wiki.model';
import { CreateModalComponent } from '../../shared/components/create-modal/create-modal.component';
import { AccessControlPanelComponent } from '../../shared/components/access-control-panel/access-control-panel.component';

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
  imports: [CommonModule, RouterModule, CreateModalComponent, AccessControlPanelComponent],
  templateUrl: './wiki-detail.component.html',
  styleUrls: ['./wiki-detail.component.css']
})
export class WikiDetailComponent implements OnInit {
  wiki$!: Observable<Wiki>;
  sections$!: Observable<SectionWithPages[]>;
  canEdit$!: Observable<boolean>;
  error: string | null = null;

  showCreateSectionModal = false;
  showCreatePageModal = false;
  showAccessControlPanel = false;
  selectedSection: SectionWithPages | null = null;

  @ViewChild('createSectionModal') createSectionModal?: CreateModalComponent;
  @ViewChild('createPageModal') createPageModal?: CreateModalComponent;

  constructor(
    private route: ActivatedRoute,
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
      // Removed auto-redirect logic - always show overview by default
      // This prevents redirect loops and makes behavior predictable
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

  onCreatePageInSection(section: SectionWithPages): void {
    this.selectedSection = section;
    this.showCreatePageModal = true;
  }

  onCreatePage(data: { title: string; slug: string }): void {
    if (!this.selectedSection) return;

    if (this.createPageModal) {
      this.createPageModal.setLoading(true);
      this.createPageModal.setError('');
    }

    this.wikiService.createPage(this.selectedSection.id, {
      title: data.title,
      slug: data.slug,
      content: ''
    }).subscribe({
      next: () => {
        this.showCreatePageModal = false;
        this.selectedSection = null;
        // Reload page to show new page
        window.location.reload();
      },
      error: (error: any) => {
        if (this.createPageModal) {
          this.createPageModal.setError(error.error?.message || 'Failed to create page');
          this.createPageModal.setLoading(false);
        }
      }
    });
  }
}
