import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Observable, EMPTY } from 'rxjs';
import { map, switchMap, shareReplay, catchError } from 'rxjs/operators';
import { LucideAngularModule, Plus, FileText, Pencil, Settings, Trash2, Paperclip } from 'lucide-angular';
import { WikiService } from '../../../core/services/wiki.service';
import { SectionService } from '../../../core/services/section.service';
import { AuthService } from '../../../core/services/auth.service';
import { Wiki, Section } from '../../../core/models/wiki.model';
import { CreateModalComponent } from '../../../shared/components/create-modal/create-modal.component';
import { ConfirmModalComponent } from '../../../shared/components/confirm-modal/confirm-modal.component';
import { AccessControlPanelComponent } from '../../../shared/components/access-control-panel/access-control-panel.component';
import { SeoService } from '../../../core/services/seo.service';

interface PageInfo {
  id: number;
  title: string;
  slug: string;
  status: string;
  updated_at?: string;
  updated_by_name?: string;
  canEdit?: boolean;
  attachment_count?: number;
}

interface SectionWithWiki extends Section {
  wiki?: Wiki;
  pages?: PageInfo[];
}

@Component({
  selector: 'app-section-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, LucideAngularModule, CreateModalComponent, ConfirmModalComponent, AccessControlPanelComponent],
  templateUrl: './section-detail.component.html',
  styleUrls: ['./section-detail.component.css']
})
export class SectionDetailComponent implements OnInit, OnDestroy {
  readonly Plus = Plus;
  readonly FileText = FileText;
  readonly Pencil = Pencil;
  readonly Settings = Settings;
  readonly Trash2 = Trash2;
  readonly Paperclip = Paperclip;

  section$!: Observable<SectionWithWiki>;
  canEdit$!: Observable<boolean>;
  error: string | null = null;

  // Modals
  showCreatePageModal = false;
  showEditSectionModal = false;
  showDeleteSectionModal = false;
  showAccessControlPanel = false;
  isDeleting = false;

  private currentSection: SectionWithWiki | null = null;
  private wikiSlug = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private wikiService: WikiService,
    private sectionService: SectionService,
    private authService: AuthService,
    private seoService: SeoService
  ) {}

  ngOnInit(): void {
    // Get route params
    const params$ = this.route.params.pipe(
      map(params => ({
        wikiSlug: params['wikiSlug'],
        sectionSlug: params['sectionSlug']
      }))
    );

    // Load section data by finding it within the wiki's sections
    this.section$ = params$.pipe(
      switchMap(({ wikiSlug, sectionSlug }) => {
        this.wikiSlug = wikiSlug;
        // First get the wiki
        return this.wikiService.getWikiBySlug(wikiSlug).pipe(
          switchMap(wikiResponse => {
            const wiki = wikiResponse.data;
            // Then get sections for this wiki
            return this.sectionService.getSectionsByWikiId(wiki.id).pipe(
              map(sections => {
                // Find the section by slug
                const section = sections.find(s => s.slug === sectionSlug);
                if (!section) {
                  throw new Error(`Section "${sectionSlug}" not found`);
                }
                // Cache section for modal operations
                this.currentSection = { ...section, wiki };

                // Update SEO meta tags
                this.seoService.updateMetaTags({
                  title: section.title,
                  description: section.description || `Browse pages in the ${section.title} section`,
                  ogType: 'website'
                });

                return this.currentSection;
              })
            );
          })
        );
      }),
      catchError(error => {
        console.error('Failed to load section:', error);
        this.error = error.error?.message || error.message || 'Failed to load section';
        return EMPTY;
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

  onCreatePage(data: { title: string; slug: string }): void {
    if (!this.currentSection) return;

    this.wikiService.createPage(this.currentSection.id, {
      title: data.title,
      slug: data.slug,
      content: ''
    }).subscribe({
      next: () => {
        this.showCreatePageModal = false;
        window.location.reload();
      },
      error: (error: any) => {
        console.error('Failed to create page:', error);
      }
    });
  }

  onEditSection(): void {
    this.showEditSectionModal = true;
  }

  onSaveSection(data: { title: string; slug: string; description: string }): void {
    if (!this.currentSection) return;

    this.wikiService.updateSection(this.currentSection.id, {
      title: data.title,
      slug: data.slug,
      description: data.description
    }).subscribe({
      next: () => {
        this.showEditSectionModal = false;
        // If slug changed, redirect to new URL
        if (data.slug !== this.currentSection?.slug) {
          this.router.navigate(['/wiki', this.wikiSlug, data.slug]);
        } else {
          window.location.reload();
        }
      },
      error: (error: any) => {
        console.error('Failed to update section:', error);
      }
    });
  }

  onDeleteSection(): void {
    this.showDeleteSectionModal = true;
  }

  onConfirmDelete(): void {
    if (!this.currentSection) return;

    this.isDeleting = true;
    this.wikiService.deleteSection(this.currentSection.id).subscribe({
      next: () => {
        this.showDeleteSectionModal = false;
        this.isDeleting = false;
        // Navigate to wiki detail page
        this.router.navigate(['/wiki', this.wikiSlug]);
      },
      error: (error: any) => {
        console.error('Failed to delete section:', error);
        this.isDeleting = false;
        this.showDeleteSectionModal = false;
      }
    });
  }

  onCancelDelete(): void {
    this.showDeleteSectionModal = false;
  }

  get deleteConfirmMessage(): string {
    if (!this.currentSection) return '';
    return `Are you sure you want to delete the section "${this.currentSection.title}"? This will also delete all pages within this section. This action cannot be undone.`;
  }

  ngOnDestroy(): void {
    this.seoService.resetToDefaults();
  }
}
