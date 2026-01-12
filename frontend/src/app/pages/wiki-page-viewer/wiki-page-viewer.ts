import { Component, OnInit, OnDestroy, AfterViewChecked, ViewChild, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { WikiService } from '../../core/services/wiki.service';
import { AuthService } from '../../core/services/auth.service';
import { PageContextService } from '../../core/services/page-context.service';
import { Page, Section } from '../../core/models/wiki.model';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Observable, throwError, EMPTY, Subject } from 'rxjs';
import { switchMap, catchError, shareReplay, tap, map, take, takeUntil } from 'rxjs/operators';
import { TinymceEditorComponent } from '../../shared/components/tinymce-editor/tinymce-editor.component';
import { CreateModalComponent } from '../../shared/components/create-modal/create-modal.component';
import { AccessControlPanelComponent } from '../../shared/components/access-control-panel/access-control-panel.component';
import { LucideAngularModule, Lock } from 'lucide-angular';

@Component({
  selector: 'app-wiki-page-viewer',
  imports: [CommonModule, FormsModule, RouterLink, TinymceEditorComponent, CreateModalComponent, AccessControlPanelComponent, LucideAngularModule],
  templateUrl: './wiki-page-viewer.html',
  styleUrl: './wiki-page-viewer.css'
})
export class WikiPageViewer implements OnInit, OnDestroy, AfterViewChecked {
  page$!: Observable<Page>;
  error: string | null = null;

  // Lucide icons
  readonly Lock = Lock;

  // Track script elements for cleanup
  private scriptElements: HTMLScriptElement[] = [];

  // Track which page we've executed scripts for (prevents re-execution)
  private lastExecutedPageId: number | null = null;
  private currentPage: Page | null = null;

  // Editing state
  isEditing = false;
  isSaving = false;

  // Content management
  editableContent = '';

  // Permission checking
  canEdit$!: Observable<boolean>;

  // UI state
  saveError: string | null = null;

  // Destroy subject for automatic unsubscribe
  private destroy$ = new Subject<void>();

  // ViewChild references
  @ViewChild('quillEditor', { static: false }) quillEditor?: TinymceEditorComponent;

  // Modal state
  showCreateSectionModal = false;
  showCreatePageModal = false;
  showAccessControlPanel = false;
  @ViewChild('createSectionModal') createSectionModal?: CreateModalComponent;
  @ViewChild('createPageModal') createPageModal?: CreateModalComponent;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private wikiService: WikiService,
    private sanitizer: DomSanitizer,
    private authService: AuthService,
    private pageContext: PageContextService
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
          map(response => response.data), // Unwrap response
          tap(page => {
            console.log('Page response:', page);
            this.currentPage = page; // Store for AfterViewChecked

            // Update page context with current page ID
            this.pageContext.updateEditState({
              currentPageId: page.id
            });
          }),
          catchError(err => {
            console.error('Page load error:', err);
            // For 404 errors, show generic message to avoid leaking page IDs
            if (err.status === 404) {
              this.error = 'Page not found';
            } else {
              this.error = err.error?.message || 'Failed to load page';
            }
            this.currentPage = null;
            this.pageContext.updateEditState({
              currentPageId: null,
              canEdit: false
            });
            return EMPTY;
          })
        );
      }),
      shareReplay(1)
    );

    // Permission check for edit button visibility - MUST subscribe to trigger tap()
    this.canEdit$ = this.authService.currentUser$.pipe(
      map(user => {
        if (!user) return false;
        return user.role === 'site_admin' || user.role === 'mobius_staff';
      }),
      tap(canEdit => {
        // Broadcast to PageContextService for header
        this.pageContext.updateEditState({ canEdit });
      }),
      shareReplay(1)
    );

    // Subscribe to canEdit$ to ensure tap executes - USE takeUntil for cleanup
    this.canEdit$.pipe(
      takeUntil(this.destroy$)
    ).subscribe();

    // Subscribe to edit state changes from header - USE takeUntil for cleanup
    this.pageContext.editState$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(state => {
      if (state.isEditing !== this.isEditing) {
        // Header triggered toggle
        this.isEditing = state.isEditing;
        this.saveError = null;

        if (this.isEditing) {
          this.enterEditMode();
        } else {
          this.exitEditMode();
        }
      }

      if (state.isSaving && !this.isSaving && this.isEditing) {
        // Header triggered save
        this.performSave();
      }
    });
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
    // Signal all subscriptions to unsubscribe
    this.destroy$.next();
    this.destroy$.complete();

    // Clean up scripts
    this.cleanupScripts();

    // Reset page context
    this.pageContext.resetEditState();
  }

  /**
   * Execute custom JavaScript for the page
   */
  private executeScripts(scripts: string): void {
    try {
      console.log('Executing page scripts');

      const scriptEl = document.createElement('script');
      scriptEl.type = 'text/javascript';
      
      // Wrap scripts in an IIFE to prevent global scope pollution and re-declaration errors
      // (e.g. "Identifier 'x' has already been declared")
      scriptEl.textContent = `
        (function() {
          try {
            ${scripts}
          } catch (e) {
            console.error('Error in page script:', e);
          }
        })();
      `;

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

  /**
   * Enter editing mode
   */
  private enterEditMode(): void {
    this.cleanupScripts();
    this.lastExecutedPageId = null;

    // Store original content for dirty checking
    this.editableContent = this.currentPage?.content || '';
  }

  /**
   * Exit editing mode
   */
  private exitEditMode(): void {
    // Ask for confirmation if dirty
    if (this.isDirty()) {
      if (!confirm('You have unsaved changes. Are you sure you want to exit without saving?')) {
        // Cancel exit - set editing back to true
        this.pageContext.updateEditState({ isEditing: true });
        return;
      }
    }

    // No manual cleanup needed - Quill handles it
  }

  /**
   * Perform save operation (triggered by header save button)
   */
  private performSave(): void {
    if (this.isSaving || !this.quillEditor) return;

    this.isSaving = true;
    this.saveError = null;

    // Get HTML from Quill editor
    const html = this.quillEditor.getValue();

    this.page$.pipe(
      take(1),
      switchMap(page =>
        this.wikiService.updatePage(page.id, { content: html })
      )
    ).subscribe({
      next: (response) => {
        this.isSaving = false;
        this.isEditing = false;

        // Update service state
        this.pageContext.updateEditState({
          isEditing: false,
          isSaving: false,
          saveError: null
        });

        // Reload page to show saved content
        window.location.reload();
      },
      error: (err) => {
        this.isSaving = false;
        // For 404 errors, show generic message to avoid leaking page IDs
        if (err.status === 404) {
          this.saveError = 'Page not found. It may have been deleted.';
        } else {
          this.saveError = err.error?.message || 'Failed to save page. Please try again.';
        }

        // Update service state with error
        this.pageContext.updateEditState({
          isSaving: false,
          saveError: this.saveError
        });
      }
    });
  }

  /**
   * Check if content has changed
   */
  isDirty(): boolean {
    if (!this.quillEditor) return false;
    return this.quillEditor.getValue() !== this.editableContent;
  }


  /**
   * Warn about unsaved changes before leaving
   */
  @HostListener('window:beforeunload', ['$event'])
  handleBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.isEditing && this.isDirty()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  /**
   * Handle section creation from modal
   */
  onCreateSection(data: { title: string; slug: string; description: string }): void {
    if (!this.currentPage?.wiki) return;

    if (this.createSectionModal) {
      this.createSectionModal.setLoading(true);
      this.createSectionModal.setError('');
    }

    // Get wiki ID from current page
    this.page$.pipe(
      take(1),
      switchMap((page: Page) => {
        // Need to get full wiki data to get wiki ID
        if (!page.wiki) {
          throw new Error('Cannot create section: wiki information not available');
        }
        return this.wikiService.getWikiBySlug(page.wiki.slug).pipe(
          map(response => response.data), // Unwrap wiki response
          switchMap((wiki) => {
            return this.wikiService.createSection(wiki.id, {
              title: data.title,
              slug: data.slug,
              description: data.description
            }).pipe(
              map(response => response.data) // Unwrap section response
            );
          })
        );
      })
    ).subscribe({
      next: () => {
        // Close modal immediately
        this.showCreateSectionModal = false;

        // Reset modal loading state
        if (this.createSectionModal) {
          this.createSectionModal.setLoading(false);
        }

        // Show success message after change detection runs
        setTimeout(() => {
          alert('Section created successfully! You can now create pages in this section.');
        }, 100);
      },
      error: (error: any) => {
        if (this.createSectionModal) {
          this.createSectionModal.setError(error.error?.message || 'Failed to create section');
          this.createSectionModal.setLoading(false);
        }
      }
    });
  }

  /**
   * Handle page creation
   */
  onCreatePage(data: { title: string; slug: string }): void {
    if (!this.currentPage || !this.currentPage.section_id) {
      alert('Cannot create page: no section context');
      return;
    }

    if (this.createPageModal) {
      this.createPageModal.setLoading(true);
      this.createPageModal.setError('');
    }

    this.wikiService.createPage(this.currentPage.section_id, {
      title: data.title,
      slug: data.slug,
      content: ''
    }).subscribe({
      next: (response) => {
        // Close modal immediately
        this.showCreatePageModal = false;

        // Reset modal loading state
        if (this.createPageModal) {
          this.createPageModal.setLoading(false);
        }

        // Navigate after change detection runs
        setTimeout(() => {
          const wikiSlug = this.currentPage?.wiki?.slug;
          const sectionSlug = this.currentPage?.section?.slug;

          if (wikiSlug && sectionSlug) {
            this.router.navigate(
              ['/wiki', wikiSlug, sectionSlug, response.data.slug]
            );
          }
        }, 100);
      },
      error: (error) => {
        if (this.createPageModal) {
          this.createPageModal.setLoading(false);
          this.createPageModal.setError(error.error?.message || 'Failed to create page');
        }
      }
    });
  }

  /**
   * Publish the current draft page
   */
  publishPage(): void {
    if (!this.currentPage) {
      alert('No page loaded');
      return;
    }

    if (this.currentPage.status !== 'draft') {
      alert('This page is already published');
      return;
    }

    if (confirm('Publish this page? It will become visible to authorized users based on access rules.')) {
      this.wikiService.publishPage(this.currentPage.id).subscribe({
        next: () => {
          alert('Page published successfully!');
          // Reload to show updated status
          window.location.reload();
        },
        error: (error: any) => {
          // For 404 errors, show generic message to avoid leaking page IDs
          if (error.status === 404) {
            alert('Page not found. It may have been deleted.');
          } else {
            alert(error.error?.message || 'Failed to publish page');
          }
        }
      });
    }
  }

  sanitizeHtml(html: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }
}
