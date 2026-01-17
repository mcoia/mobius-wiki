import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Observable, EMPTY } from 'rxjs';
import { map, switchMap, shareReplay, catchError, take } from 'rxjs/operators';
import { LucideAngularModule, Lock, Plus, FileText, Pencil, Settings, Trash2, ChevronUp, ChevronDown } from 'lucide-angular';
import { WikiService } from '../../core/services/wiki.service';
import { SectionService } from '../../core/services/section.service';
import { AuthService } from '../../core/services/auth.service';
import { Wiki, Section } from '../../core/models/wiki.model';
import { CreateModalComponent } from '../../shared/components/create-modal/create-modal.component';
import { ConfirmModalComponent } from '../../shared/components/confirm-modal/confirm-modal.component';
import { AccessControlPanelComponent } from '../../shared/components/access-control-panel/access-control-panel.component';

interface SectionWithPages extends Section {
  pages?: Array<{
    id: number;
    title: string;
    slug: string;
    status: string;
    updated_at?: string;
    updated_by_name?: string;
    canEdit?: boolean;
  }>;
}

@Component({
  selector: 'app-wiki-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, LucideAngularModule, CreateModalComponent, ConfirmModalComponent, AccessControlPanelComponent],
  templateUrl: './wiki-detail.component.html',
  styleUrls: ['./wiki-detail.component.css']
})
export class WikiDetailComponent implements OnInit {
  readonly Lock = Lock;
  readonly Plus = Plus;
  readonly FileText = FileText;
  readonly Pencil = Pencil;
  readonly Settings = Settings;
  readonly Trash2 = Trash2;
  readonly ChevronUp = ChevronUp;
  readonly ChevronDown = ChevronDown;

  wiki$!: Observable<Wiki>;
  sections$!: Observable<SectionWithPages[]>;
  canEdit$!: Observable<boolean>;
  error: string | null = null;

  showCreateSectionModal = false;
  showCreatePageModal = false;
  showEditSectionModal = false;
  showDeleteSectionModal = false;
  showAccessControlPanel = false;
  selectedSection: SectionWithPages | null = null;
  sectionToEdit: SectionWithPages | null = null;
  sectionToDelete: SectionWithPages | null = null;
  isDeleting = false;

  // Keep a local copy of sections for reordering
  private sectionsCache: SectionWithPages[] = [];

  @ViewChild('createSectionModal') createSectionModal?: CreateModalComponent;
  @ViewChild('createPageModal') createPageModal?: CreateModalComponent;
  @ViewChild('editSectionModal') editSectionModal?: CreateModalComponent;

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
      map(sections => {
        // Cache sections for reordering operations
        this.sectionsCache = sections;
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
}
