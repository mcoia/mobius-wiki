import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Observable, EMPTY } from 'rxjs';
import { map, switchMap, shareReplay, catchError, take } from 'rxjs/operators';
import { LucideAngularModule, Lock, Plus, FileText, Pencil, Settings, Trash2, ChevronUp, ChevronDown, ChevronRight, ChevronsDown, ChevronsUp, Archive, ArchiveRestore, Paperclip } from 'lucide-angular';
import { WikiService } from '../../core/services/wiki.service';
import { SectionService } from '../../core/services/section.service';
import { AuthService } from '../../core/services/auth.service';
import { Wiki, Section } from '../../core/models/wiki.model';
import { CreateModalComponent } from '../../shared/components/create-modal/create-modal.component';
import { ConfirmModalComponent } from '../../shared/components/confirm-modal/confirm-modal.component';
import { AccessControlPanelComponent } from '../../shared/components/access-control-panel/access-control-panel.component';
import { SeoService } from '../../core/services/seo.service';

interface SectionWithPages extends Section {
  pages?: Array<{
    id: number;
    title: string;
    slug: string;
    status: string;
    updated_at?: string;
    updated_by_name?: string;
    canEdit?: boolean;
    attachment_count?: number;
  }>;
}

@Component({
  selector: 'app-wiki-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, LucideAngularModule, CreateModalComponent, ConfirmModalComponent, AccessControlPanelComponent],
  templateUrl: './wiki-detail.component.html',
  styleUrls: ['./wiki-detail.component.css']
})
export class WikiDetailComponent implements OnInit, OnDestroy {
  readonly Lock = Lock;
  readonly Plus = Plus;
  readonly FileText = FileText;
  readonly Pencil = Pencil;
  readonly Settings = Settings;
  readonly Trash2 = Trash2;
  readonly ChevronUp = ChevronUp;
  readonly ChevronDown = ChevronDown;
  readonly ChevronRight = ChevronRight;
  readonly ChevronsDown = ChevronsDown;
  readonly ChevronsUp = ChevronsUp;
  readonly Archive = Archive;
  readonly ArchiveRestore = ArchiveRestore;
  readonly Paperclip = Paperclip;

  // Collapsible sections
  expandedSections: Set<number> = new Set();
  private readonly STORAGE_KEY_PREFIX = 'mobius_wiki_detail_sections_';

  wiki$!: Observable<Wiki>;
  sections$!: Observable<SectionWithPages[]>;
  canEdit$!: Observable<boolean>;
  error: string | null = null;

  // Section modals
  showCreateSectionModal = false;
  showCreatePageModal = false;
  showEditSectionModal = false;
  showDeleteSectionModal = false;
  showAccessControlPanel = false;
  selectedSection: SectionWithPages | null = null;
  sectionToEdit: SectionWithPages | null = null;
  sectionToDelete: SectionWithPages | null = null;
  isDeleting = false;

  // Wiki modals
  showEditWikiModal = false;
  showDeleteWikiModal = false;
  currentWiki: Wiki | null = null;
  isArchiving = false;
  isDeletingWiki = false;

  // Keep a local copy of sections for reordering
  private sectionsCache: SectionWithPages[] = [];

  @ViewChild('createSectionModal') createSectionModal?: CreateModalComponent;
  @ViewChild('createPageModal') createPageModal?: CreateModalComponent;
  @ViewChild('editSectionModal') editSectionModal?: CreateModalComponent;
  @ViewChild('editWikiModal') editWikiModal?: CreateModalComponent;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private wikiService: WikiService,
    private sectionService: SectionService,
    private authService: AuthService,
    private seoService: SeoService
  ) {}

  ngOnInit(): void {
    const wikiSlug$ = this.route.params.pipe(
      map(params => params['wikiSlug'])
    );

    // Load wiki data
    this.wiki$ = wikiSlug$.pipe(
      switchMap(slug => this.wikiService.getWikiBySlug(slug)),
      map(response => response.data), // Unwrap response
      map(wiki => {
        // Cache wiki for edit/delete operations
        this.currentWiki = wiki;

        // Update SEO meta tags
        this.seoService.updateMetaTags({
          title: wiki.title,
          description: wiki.description || `Browse ${wiki.title} documentation`,
          ogType: 'website'
        });

        return wiki;
      }),
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
      map(sections => {
        // Cache sections for reordering operations
        this.sectionsCache = sections;
        // Load expanded sections state from localStorage
        if (this.currentWiki) {
          this.loadExpandedSections(this.currentWiki.id);
        }
        return sections;
      }),
      catchError(error => {
        console.error('Failed to load sections:', error);
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

  // Collapsible section methods
  toggleSection(sectionId: number): void {
    if (this.expandedSections.has(sectionId)) {
      this.expandedSections.delete(sectionId);
    } else {
      this.expandedSections.add(sectionId);
    }
    if (this.currentWiki) {
      this.saveExpandedSections(this.currentWiki.id);
    }
  }

  isSectionExpanded(sectionId: number): boolean {
    return this.expandedSections.has(sectionId);
  }

  private loadExpandedSections(wikiId: number): void {
    try {
      const key = `${this.STORAGE_KEY_PREFIX}${wikiId}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        const ids: number[] = JSON.parse(stored);
        this.expandedSections = new Set(ids);
      } else {
        // First visit: expand all sections by default
        this.sectionsCache.forEach(section => {
          this.expandedSections.add(section.id);
        });
      }
    } catch {
      // Fallback: expand all sections
      this.sectionsCache.forEach(section => {
        this.expandedSections.add(section.id);
      });
    }
  }

  private saveExpandedSections(wikiId: number): void {
    try {
      const key = `${this.STORAGE_KEY_PREFIX}${wikiId}`;
      const ids = Array.from(this.expandedSections);
      localStorage.setItem(key, JSON.stringify(ids));
    } catch {
      // Ignore storage errors
    }
  }

  expandAllSections(): void {
    this.sectionsCache.forEach(section => {
      this.expandedSections.add(section.id);
    });
    if (this.currentWiki) {
      this.saveExpandedSections(this.currentWiki.id);
    }
  }

  collapseAllSections(): void {
    this.expandedSections.clear();
    if (this.currentWiki) {
      this.saveExpandedSections(this.currentWiki.id);
    }
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

  // Section Management Methods

  onEditSection(section: SectionWithPages): void {
    this.sectionToEdit = section;
    this.showEditSectionModal = true;
  }

  onSaveSection(data: { title: string; slug: string; description: string }): void {
    if (!this.sectionToEdit) return;

    if (this.editSectionModal) {
      this.editSectionModal.setLoading(true);
      this.editSectionModal.setError('');
    }

    this.wikiService.updateSection(this.sectionToEdit.id, {
      title: data.title,
      slug: data.slug,
      description: data.description
    }).subscribe({
      next: () => {
        this.showEditSectionModal = false;
        this.sectionToEdit = null;
        window.location.reload();
      },
      error: (error: any) => {
        if (this.editSectionModal) {
          this.editSectionModal.setError(error.error?.message || 'Failed to update section');
          this.editSectionModal.setLoading(false);
        }
      }
    });
  }

  onDeleteSection(section: SectionWithPages): void {
    this.sectionToDelete = section;
    this.showDeleteSectionModal = true;
  }

  onConfirmDelete(): void {
    if (!this.sectionToDelete) return;

    this.isDeleting = true;
    this.wikiService.deleteSection(this.sectionToDelete.id).subscribe({
      next: () => {
        this.showDeleteSectionModal = false;
        this.sectionToDelete = null;
        this.isDeleting = false;
        window.location.reload();
      },
      error: (error: any) => {
        console.error('Failed to delete section:', error);
        this.isDeleting = false;
        // Could show error in modal, but for now just close and log
        this.showDeleteSectionModal = false;
        this.sectionToDelete = null;
      }
    });
  }

  onCancelDelete(): void {
    this.showDeleteSectionModal = false;
    this.sectionToDelete = null;
  }

  onMoveSection(section: SectionWithPages, direction: 'up' | 'down'): void {
    const sections = this.sectionsCache;
    const currentIndex = sections.findIndex(s => s.id === section.id);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= sections.length) return;

    const targetSection = sections[targetIndex];

    // Swap sort orders (backend expects camelCase 'sortOrder')
    const currentSortOrder = section.sort_order;
    const targetSortOrder = targetSection.sort_order;

    // Update both sections
    this.wikiService.updateSection(section.id, { sortOrder: targetSortOrder } as any).pipe(
      switchMap(() => this.wikiService.updateSection(targetSection.id, { sortOrder: currentSortOrder } as any))
    ).subscribe({
      next: () => {
        window.location.reload();
      },
      error: (error: any) => {
        console.error('Failed to reorder sections:', error);
      }
    });
  }

  isFirstSection(section: SectionWithPages): boolean {
    if (this.sectionsCache.length === 0) return true;
    return this.sectionsCache[0]?.id === section.id;
  }

  isLastSection(section: SectionWithPages): boolean {
    if (this.sectionsCache.length === 0) return true;
    return this.sectionsCache[this.sectionsCache.length - 1]?.id === section.id;
  }

  get deleteConfirmMessage(): string {
    if (!this.sectionToDelete) return '';
    return `Are you sure you want to delete the section "${this.sectionToDelete.title}"? This will also delete all pages within this section. This action cannot be undone.`;
  }

  // Wiki Management Methods

  onEditWiki(): void {
    this.showEditWikiModal = true;
  }

  onSaveWiki(data: { title: string; slug: string; description: string }): void {
    if (!this.currentWiki) return;

    if (this.editWikiModal) {
      this.editWikiModal.setLoading(true);
      this.editWikiModal.setError('');
    }

    this.wikiService.updateWiki(this.currentWiki.id, {
      title: data.title,
      slug: data.slug,
      description: data.description
    }).subscribe({
      next: () => {
        this.showEditWikiModal = false;
        // If slug changed, redirect to new URL
        if (data.slug !== this.currentWiki?.slug) {
          this.router.navigate(['/wiki', data.slug]);
        } else {
          window.location.reload();
        }
      },
      error: (error: any) => {
        if (this.editWikiModal) {
          this.editWikiModal.setError(error.error?.message || 'Failed to update wiki');
          this.editWikiModal.setLoading(false);
        }
      }
    });
  }

  onDeleteWiki(): void {
    this.showDeleteWikiModal = true;
  }

  onConfirmDeleteWiki(): void {
    if (!this.currentWiki) return;

    this.isDeletingWiki = true;
    this.wikiService.deleteWiki(this.currentWiki.id).subscribe({
      next: () => {
        this.showDeleteWikiModal = false;
        this.isDeletingWiki = false;
        // Navigate to wiki list
        this.router.navigate(['/wikis']);
      },
      error: (error: any) => {
        console.error('Failed to delete wiki:', error);
        this.isDeletingWiki = false;
        this.showDeleteWikiModal = false;
      }
    });
  }

  onCancelDeleteWiki(): void {
    this.showDeleteWikiModal = false;
  }

  onToggleArchive(): void {
    if (!this.currentWiki) return;

    this.isArchiving = true;
    const operation = this.currentWiki.archived_at
      ? this.wikiService.unarchiveWiki(this.currentWiki.id)
      : this.wikiService.archiveWiki(this.currentWiki.id);

    operation.subscribe({
      next: () => {
        this.isArchiving = false;
        window.location.reload();
      },
      error: (error: any) => {
        console.error('Failed to archive/unarchive wiki:', error);
        this.isArchiving = false;
      }
    });
  }

  get deleteWikiConfirmMessage(): string {
    if (!this.currentWiki) return '';
    return `Are you sure you want to delete the wiki "${this.currentWiki.title}"? This will delete ALL sections and pages within this wiki. This action cannot be undone.`;
  }

  ngOnDestroy(): void {
    this.seoService.resetToDefaults();
  }
}
