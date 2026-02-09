import { Component, OnInit, OnDestroy, AfterViewChecked, ViewChild, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { WikiService } from '../../core/services/wiki.service';
import { AuthService } from '../../core/services/auth.service';
import { PageContextService } from '../../core/services/page-context.service';
import { TocService, TocItem } from '../../core/services/toc.service';
import { SeoService } from '../../core/services/seo.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { ConflictDialogService } from '../../core/services/conflict-dialog.service';
import { EditSessionService, ActiveEditor } from '../../core/services/edit-session.service';
import { ToastService } from '../../core/services/toast.service';
import { Page, Section, PageVersion } from '../../core/models/wiki.model';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Observable, EMPTY, Subject, combineLatest, of, BehaviorSubject, Subscription } from 'rxjs';
import { switchMap, catchError, shareReplay, tap, map, take, takeUntil } from 'rxjs/operators';
import { TinymceEditorComponent } from '../../shared/components/tinymce-editor/tinymce-editor.component';
import { CreateModalComponent } from '../../shared/components/create-modal/create-modal.component';
import { AccessControlPanelComponent } from '../../shared/components/access-control-panel/access-control-panel.component';
import { VersionBannerComponent } from '../../shared/components/version-banner/version-banner.component';
import { AttachmentsPanelComponent } from '../../shared/components/attachments-panel/attachments-panel.component';
import { LucideAngularModule, Lock, Pencil, ArrowRightFromLine, Trash2, Plus, Save, X, ChevronDown, Download, FileText, FileCode, Printer } from 'lucide-angular';

@Component({
  selector: 'app-wiki-page-viewer',
  imports: [CommonModule, FormsModule, RouterLink, TinymceEditorComponent, CreateModalComponent, AccessControlPanelComponent, VersionBannerComponent, AttachmentsPanelComponent, LucideAngularModule],
  templateUrl: './wiki-page-viewer.html',
  styleUrl: './wiki-page-viewer.css'
})
export class WikiPageViewer implements OnInit, OnDestroy, AfterViewChecked {
  page$!: Observable<Page>;
  error: string | null = null;

  // Lucide icons
  readonly Lock = Lock;
  readonly Pencil = Pencil;
  readonly ArrowRightFromLine = ArrowRightFromLine;
  readonly Trash2 = Trash2;
  readonly Plus = Plus;
  readonly Save = Save;
  readonly X = X;
  readonly ChevronDown = ChevronDown;
  readonly Download = Download;
  readonly FileText = FileText;
  readonly FileCode = FileCode;
  readonly Printer = Printer;

  // Track script elements for cleanup
  private scriptElements: HTMLScriptElement[] = [];

  // Track which page we've executed scripts for (prevents re-execution)
  private lastExecutedPageId: number | null = null;
  private currentPage: Page | null = null;

  // TOC (table of contents) tracking
  private lastTocPageId: number | null = null;
  private tocObserver?: IntersectionObserver;

  // Copy button tracking (prevents re-injection on view check)
  private lastCopyButtonsPageId: number | null = null;

  // Editing state
  isEditing = false;
  isSaving = false;

  // Content management
  editableContent = '';

  // Permission checking
  canEdit$!: Observable<boolean>;

  // Available sections for move dropdown
  availableSections$!: Observable<Section[]>;
  private availableSections: Section[] = [];

  // Version history
  versions$!: Observable<PageVersion[]>;
  viewingVersionNumber: number | null = null;

  // UI state
  saveError: string | null = null;

  // Cached sanitized HTML (prevents re-render on every change detection cycle)
  sanitizedContent: SafeHtml | null = null;

  // Destroy subject for automatic unsubscribe
  private destroy$ = new Subject<void>();

  // ViewChild references
  @ViewChild('quillEditor', { static: false }) quillEditor?: TinymceEditorComponent;

  // Modal state
  showCreateSectionModal = false;
  showCreatePageModal = false;
  showAccessControlPanel = false;
  showMoveDropdown = false;
  showExportDropdown = false;
  @ViewChild('createSectionModal') createSectionModal?: CreateModalComponent;
  @ViewChild('createPageModal') createPageModal?: CreateModalComponent;

  // Active editors tracking
  activeEditors$ = new BehaviorSubject<ActiveEditor[]>([]);
  private activeEditorsPolling?: Subscription;

  // Conflict detection - track version when editing starts
  private editStartVersion?: number;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private wikiService: WikiService,
    private sanitizer: DomSanitizer,
    private authService: AuthService,
    private pageContext: PageContextService,
    private tocService: TocService,
    private confirmDialog: ConfirmDialogService,
    private conflictDialog: ConflictDialogService,
    private editSessionService: EditSessionService,
    private toast: ToastService,
    private seoService: SeoService
  ) {}

  ngOnInit(): void {
    this.page$ = combineLatest([this.route.params, this.route.queryParams]).pipe(
      tap(([params, queryParams]) => {
        console.log('Route params/query changed:', params, queryParams);
        this.error = null;
        this.cleanupScripts();
        this.lastExecutedPageId = null; // Reset on navigation
        this.lastCopyButtonsPageId = null; // Reset copy buttons on navigation
        this.currentPage = null;

        // Track which version we're viewing (null = current)
        const versionParam = queryParams['version'];
        this.viewingVersionNumber = versionParam ? parseInt(versionParam, 10) : null;
      }),
      switchMap(([params, queryParams]) => {
        const wikiSlug = params['wikiSlug'];
        const sectionSlug = params['sectionSlug'];
        const pageSlug = params['pageSlug'];
        const viewPublished = queryParams['viewPublished'] === 'true';
        const versionNumber = queryParams['version'] ? parseInt(queryParams['version'], 10) : null;

        console.log('Loading page:', { wikiSlug, sectionSlug, pageSlug, viewPublished, versionNumber });

        const request = sectionSlug
          ? this.wikiService.getPagesBySlugs(wikiSlug, sectionSlug, pageSlug, viewPublished)
          : this.wikiService.getPageBySlug(wikiSlug, pageSlug, viewPublished);

        return request.pipe(
          map(response => response.data), // Unwrap response
          switchMap(page => {
            // If viewing a specific historical version, fetch that version's content
            if (versionNumber && versionNumber !== page.currentVersionNumber) {
              return this.wikiService.getPageVersion(page.id, versionNumber).pipe(
                map(version => ({
                  ...page,
                  content: version.content,
                  title: version.title,
                  scripts: version.scripts
                })),
                catchError(() => {
                  // If version not found, just show current page
                  this.toast.warning(`Version ${versionNumber} not found, showing current version`);
                  this.viewingVersionNumber = null;
                  return of(page);
                })
              );
            }
            return of(page);
          }),
          tap(page => {
            console.log('Page response:', page);
            this.currentPage = page; // Store for AfterViewChecked

            // Cache sanitized HTML to prevent re-render flash on every change detection cycle
            this.sanitizedContent = this.sanitizer.bypassSecurityTrustHtml(page.content || '');

            // Update page context with current page ID
            this.pageContext.updateEditState({
              currentPageId: page.id
            });

            // Update SEO meta tags
            const description = this.seoService.extractDescription(page.content || '');
            this.seoService.updateMetaTags({
              title: page.title,
              description,
              ogType: 'article',
              modifiedTime: page.updated_at
            });

            // Set JSON-LD structured data
            const pageUrl = window.location.href;
            this.seoService.setJsonLd(this.seoService.generateArticleSchema({
              title: page.title,
              description,
              url: pageUrl,
              dateModified: page.updated_at,
              authorName: page.author?.name
            }));
          }),
          catchError(err => {
            console.error('Page load error:', err);

            this.currentPage = null;
            this.pageContext.updateEditState({
              currentPageId: null,
              canEdit: false
            });

            // Navigate to error pages based on status code
            if (err.status === 403) {
              // Access denied - navigate to 403 page with returnUrl
              this.router.navigate(['/403'], {
                queryParams: { returnUrl: this.router.url }
              });
            } else if (err.status === 404) {
              // Page not found - navigate to 404 page
              this.router.navigate(['/404']);
            } else {
              // Other errors - show inline error message
              this.error = err.error?.message || 'Failed to load page';
            }

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

    // Load available sections for move dropdown
    this.availableSections$ = this.page$.pipe(
      switchMap(page => {
        if (!page || !page.wiki) {
          return of([]);
        }
        // Get wiki ID from the page's wiki property (need to get wiki details first)
        return this.wikiService.getWikiBySlug(page.wiki.slug).pipe(
          switchMap(wikiResponse => {
            return this.wikiService.getSectionsByWikiId(wikiResponse.data.id).pipe(
              map(sectionsResponse => sectionsResponse.data),
              map(sections => sections.filter(s => s.id !== page.section_id)) // Exclude current section
            );
          }),
          catchError(() => of([]))
        );
      }),
      shareReplay(1)
    );

    // Subscribe to store sections for navigation after move
    this.availableSections$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(sections => {
      this.availableSections = sections;
    });

    // Load version history for version dropdown
    this.versions$ = this.page$.pipe(
      switchMap(page => {
        if (!page) {
          return of([]);
        }
        return this.wikiService.getPageVersions(page.id).pipe(
          map(response => response.data),
          catchError(() => of([]))
        );
      }),
      shareReplay(1)
    );

    // Subscribe to canEdit$ to ensure tap executes - USE takeUntil for cleanup
    this.canEdit$.pipe(
      takeUntil(this.destroy$)
    ).subscribe();

    // Check for edit query param to auto-enter edit mode
    combineLatest([this.page$, this.canEdit$, this.route.queryParams]).pipe(
      take(1) // Only check once on initial load
    ).subscribe(([page, canEdit, queryParams]) => {
      if (queryParams['edit'] === 'true' && canEdit && page) {
        // Slight delay to ensure component is fully initialized
        setTimeout(() => {
          this.pageContext.updateEditState({ isEditing: true });
        }, 100);
      }
    });

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

    // Extract TOC headings once per page (not while editing)
    if (
      this.currentPage &&
      !this.isEditing &&
      this.lastTocPageId !== this.currentPage.id
    ) {
      this.extractHeadings();
      this.lastTocPageId = this.currentPage.id;
    }

    // Add copy buttons to code blocks once per page (not while editing)
    if (
      this.currentPage &&
      !this.isEditing &&
      this.lastCopyButtonsPageId !== this.currentPage.id
    ) {
      this.addCopyButtons();
      this.lastCopyButtonsPageId = this.currentPage.id;
    }
  }

  ngOnDestroy(): void {
    // Signal all subscriptions to unsubscribe
    this.destroy$.next();
    this.destroy$.complete();

    // Clean up scripts
    this.cleanupScripts();

    // Clear TOC
    this.clearToc();

    // Clean up edit session if still active
    if (this.isEditing) {
      this.editSessionService.stopSession();
    }
    if (this.activeEditorsPolling) {
      this.activeEditorsPolling.unsubscribe();
    }

    // Reset page context
    this.pageContext.resetEditState();

    // Reset SEO tags to defaults
    this.seoService.resetToDefaults();
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
   * Extract headings from page content and update TOC service
   */
  private extractHeadings(): void {
    const pageContent = document.querySelector('.page-content');
    if (!pageContent) return;

    const headings = pageContent.querySelectorAll('h1, h2, h3, h4, h5, h6');
    const tocItems: TocItem[] = [];

    headings.forEach((heading, index) => {
      const el = heading as HTMLElement;

      // Generate ID if missing
      if (!el.id) {
        const slug = this.slugify(el.textContent || '');
        el.id = slug ? `${slug}-${index}` : `heading-${index}`;
      }

      tocItems.push({
        id: el.id,
        text: el.textContent?.trim() || '',
        level: parseInt(el.tagName.charAt(1), 10)
      });
    });

    this.tocService.setHeadings(tocItems);

    // Set up scroll tracking if we have headings
    if (tocItems.length > 0) {
      this.setupScrollTracking(headings as NodeListOf<HTMLElement>);
    }
  }

  /**
   * Convert text to URL-friendly slug
   */
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);
  }

  /**
   * Set up Intersection Observer to track which heading is currently visible
   */
  private setupScrollTracking(headings: NodeListOf<HTMLElement>): void {
    // Clean up any existing observer
    this.cleanupTocObserver();

    this.tocObserver = new IntersectionObserver(
      (entries) => {
        // Find the first intersecting entry
        for (const entry of entries) {
          if (entry.isIntersecting) {
            this.tocService.setActiveHeading(entry.target.id);
            break;
          }
        }
      },
      {
        // Trigger when heading enters top 30% of viewport
        rootMargin: '-20% 0px -70% 0px'
      }
    );

    headings.forEach(h => this.tocObserver!.observe(h));
  }

  /**
   * Clean up TOC observer and clear headings
   */
  private cleanupTocObserver(): void {
    if (this.tocObserver) {
      this.tocObserver.disconnect();
      this.tocObserver = undefined;
    }
  }

  /**
   * Clear TOC state
   */
  private clearToc(): void {
    this.cleanupTocObserver();
    this.tocService.clearHeadings();
    this.lastTocPageId = null;
  }

  /**
   * Add copy buttons to code blocks in page content
   */
  private addCopyButtons(): void {
    const pageContent = document.querySelector('.page-content');
    if (!pageContent) return;

    // Find all pre elements and .listingblock elements (AsciiDoc-style)
    const codeBlocks = pageContent.querySelectorAll('pre, .listingblock');

    codeBlocks.forEach((block) => {
      // Skip if already wrapped with copy button
      if (block.closest('.code-block-wrapper')) return;

      // For listingblock, find the pre inside; for pre, use it directly
      const preElement = block.tagName === 'PRE' ? block : block.querySelector('pre');
      if (!preElement) return;

      // Create wrapper for positioning
      const wrapper = document.createElement('div');
      wrapper.className = 'code-block-wrapper';
      block.parentNode?.insertBefore(wrapper, block);
      wrapper.appendChild(block);

      // Create copy button with SVG icon
      const btn = document.createElement('button');
      btn.className = 'copy-btn';
      btn.title = 'Copy to clipboard';
      btn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
        </svg>
      `;

      btn.addEventListener('click', () => this.copyToClipboard(preElement, btn));
      preElement.appendChild(btn);
    });
  }

  /**
   * Copy code block content to clipboard
   */
  private copyToClipboard(element: Element, button: HTMLButtonElement): void {
    const text = element.textContent || '';
    navigator.clipboard.writeText(text).then(() => {
      // Show success feedback
      this.toast.success('Copied to clipboard');

      // Visual feedback on button
      button.classList.add('copied');
      setTimeout(() => button.classList.remove('copied'), 2000);
    }).catch(() => {
      this.toast.error('Failed to copy to clipboard');
    });
  }

  /**
   * Enter editing mode
   */
  private enterEditMode(): void {
    this.cleanupScripts();
    this.lastExecutedPageId = null;

    // Clear TOC while editing
    this.clearToc();

    // Store original content for dirty checking
    this.editableContent = this.currentPage?.content || '';

    // Track version for conflict detection
    this.editStartVersion = this.currentPage?.currentVersionNumber;

    // Start edit session and fetch active editors
    if (this.currentPage?.id) {
      const pageId = this.currentPage.id;

      // Start the edit session (sends heartbeat)
      this.editSessionService.startSession(pageId).subscribe({
        error: (err) => console.error('Failed to start edit session:', err)
      });

      // Initial fetch of active editors
      this.editSessionService.getActiveEditors(pageId).subscribe({
        next: (editors) => this.activeEditors$.next(editors),
        error: (err) => console.error('Failed to fetch active editors:', err)
      });

      // Start polling for active editors
      this.activeEditorsPolling = this.editSessionService
        .startActiveEditorsPolling(pageId)
        .subscribe({
          next: (editors) => this.activeEditors$.next(editors),
          error: (err) => console.error('Active editors polling error:', err)
        });
    }
  }

  /**
   * Exit editing mode
   */
  private exitEditMode(): void {
    // Ask for confirmation if dirty
    if (this.isDirty()) {
      this.confirmDialog.open({
        title: 'Unsaved Changes',
        message: 'You have unsaved changes. Are you sure you want to exit without saving?',
        type: 'warning',
        confirmText: 'Exit Without Saving',
        cancelText: 'Continue Editing'
      }).subscribe(confirmed => {
        if (!confirmed) {
          // Cancel exit - set editing back to true
          this.pageContext.updateEditState({ isEditing: true });
        } else {
          // User confirmed exit - clean up edit session
          this.cleanupEditSession();
        }
      });
      return;
    }

    // Clean up edit session
    this.cleanupEditSession();
  }

  /**
   * Clean up edit session resources
   */
  private cleanupEditSession(): void {
    // Stop polling for active editors
    if (this.activeEditorsPolling) {
      this.activeEditorsPolling.unsubscribe();
      this.activeEditorsPolling = undefined;
    }

    // Clear active editors
    this.activeEditors$.next([]);

    // End the edit session on the server
    if (this.currentPage?.id) {
      this.editSessionService.endSession(this.currentPage.id).subscribe({
        error: (err) => console.error('Failed to end edit session:', err)
      });
    }

    // Clear version tracking
    this.editStartVersion = undefined;
  }

  /**
   * Perform save operation (triggered by header save button)
   */
  private performSave(forceOverwrite = false): void {
    if (this.isSaving || !this.quillEditor) return;

    this.isSaving = true;
    this.saveError = null;

    // Get HTML from Quill editor
    const html = this.quillEditor.getValue();

    this.page$.pipe(
      take(1),
      switchMap(page => {
        // Include expectedVersion for conflict detection (unless forcing overwrite)
        const updateData: { content: string; expectedVersion?: number } = { content: html };
        if (!forceOverwrite && this.editStartVersion !== undefined) {
          updateData.expectedVersion = this.editStartVersion;
        }
        return this.wikiService.updatePage(page.id, updateData);
      })
    ).subscribe({
      next: () => {
        this.isSaving = false;
        this.isEditing = false;

        // Clean up edit session
        this.cleanupEditSession();

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

        // Handle conflict (409)
        if (err.status === 409 && err.error) {
          this.handleSaveConflict(err.error);
          return;
        }

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
   * Handle save conflict by showing the conflict dialog
   */
  private handleSaveConflict(conflictData: {
    message: string;
    currentVersion: number;
    expectedVersion: number;
    lastModifiedBy: string;
    lastModifiedAt: string;
  }): void {
    this.conflictDialog.open({
      lastModifiedBy: conflictData.lastModifiedBy,
      lastModifiedAt: conflictData.lastModifiedAt,
      currentVersion: conflictData.currentVersion,
      expectedVersion: conflictData.expectedVersion
    }).subscribe(result => {
      switch (result) {
        case 'view-changes':
          // Navigate to version history
          if (this.currentPage) {
            this.router.navigate([], {
              relativeTo: this.route,
              queryParams: { version: conflictData.currentVersion },
              queryParamsHandling: 'merge'
            });
            // Exit edit mode to view the version
            this.isEditing = false;
            this.pageContext.updateEditState({ isEditing: false });
            this.cleanupEditSession();
          }
          break;

        case 'save-anyway':
          // Re-attempt save without version check
          this.performSave(true);
          break;

        case 'cancel':
          // Update service state
          this.pageContext.updateEditState({
            isSaving: false,
            saveError: null
          });
          break;
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
   * Toggle edit mode (for Edit Page button)
   */
  toggleEdit(): void {
    const currentState = this.pageContext.currentState;
    this.pageContext.updateEditState({
      isEditing: !currentState.isEditing
    });
  }

  /**
   * Trigger save operation (for Save Changes button)
   */
  saveContent(): void {
    this.pageContext.updateEditState({
      isSaving: true
    });
  }

  /**
   * View published version (for version banner toggle)
   */
  viewPublishedVersion(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { viewPublished: 'true' },
      queryParamsHandling: 'merge'
    });
  }

  /**
   * View draft version (for version banner toggle)
   */
  viewDraftVersion(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { viewPublished: null, version: null },
      queryParamsHandling: 'merge'
    });
  }

  /**
   * Select a specific version to view
   */
  selectVersion(versionNumber: number): void {
    // If selecting the current version, clear the version param
    if (this.currentPage && versionNumber === this.currentPage.currentVersionNumber) {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { version: null, viewPublished: null },
        queryParamsHandling: 'merge'
      });
    } else {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { version: versionNumber, viewPublished: null },
        queryParamsHandling: 'merge'
      });
    }
  }

  /**
   * Restore a historical version as a new draft
   */
  restoreVersion(versionNumber: number): void {
    if (!this.currentPage) {
      this.toast.error('No page loaded');
      return;
    }

    this.confirmDialog.open({
      title: 'Restore Version',
      message: `Restore version ${versionNumber} as a new draft? The current content will be preserved in version history.`,
      type: 'info',
      confirmText: 'Restore as Draft',
      cancelText: 'Cancel'
    }).subscribe(confirmed => {
      if (!confirmed) return;

      this.wikiService.restoreVersion(this.currentPage!.id, versionNumber).subscribe({
        next: () => {
          this.toast.success(`Version ${versionNumber} restored as new draft`);
          // Navigate to the page without version param to show the new draft
          this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { version: null, viewPublished: null },
            queryParamsHandling: 'merge'
          }).then(() => {
            window.location.reload();
          });
        },
        error: (err) => {
          console.error('Restore error:', err);
          this.toast.error(err.error?.message || 'Failed to restore version');
        }
      });
    });
  }

  /**
   * Discard draft and revert to published version
   */
  discardDraft(): void {
    this.confirmDialog.open({
      title: 'Discard Draft',
      message: 'Discard all draft changes and revert to published version? This cannot be undone.',
      type: 'danger',
      confirmText: 'Discard Draft',
      cancelText: 'Keep Draft'
    }).subscribe(confirmed => {
      if (!confirmed) return;

      this.page$.pipe(take(1)).subscribe(page => {
        this.wikiService.discardDraft(page.id).subscribe({
          next: () => {
            window.location.reload();
          },
          error: (err) => {
            console.error('Discard error:', err);
            this.error = 'Failed to discard draft';
          }
        });
      });
    });
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
          this.toast.success('Section created successfully! You can now create pages in this section.');
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
      this.toast.error('Cannot create page: no section context');
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
      this.toast.error('No page loaded');
      return;
    }

    if (this.currentPage.status !== 'draft') {
      this.toast.warning('This page is already published');
      return;
    }

    this.confirmDialog.open({
      title: 'Publish Page',
      message: 'This page will become visible to authorized users based on access rules.',
      type: 'warning',
      confirmText: 'Publish',
      cancelText: 'Cancel'
    }).subscribe(confirmed => {
      if (!confirmed) return;

      this.wikiService.publishPage(this.currentPage!.id).subscribe({
        next: () => {
          this.toast.success('Page published successfully!');
          // Reload to show updated status
          setTimeout(() => window.location.reload(), 1000);
        },
        error: (error: any) => {
          // For 404 errors, show generic message to avoid leaking page IDs
          if (error.status === 404) {
            this.toast.error('Page not found. It may have been deleted.');
          } else {
            this.toast.error(error.error?.message || 'Failed to publish page');
          }
        }
      });
    });
  }

  /**
   * Delete the current page
   */
  deletePage(): void {
    if (!this.currentPage) {
      this.toast.error('No page loaded');
      return;
    }

    this.confirmDialog.open({
      title: 'Delete Page',
      message: `Delete page "${this.currentPage.title}"? This action cannot be undone.`,
      type: 'danger',
      confirmText: 'Delete',
      cancelText: 'Cancel'
    }).subscribe(confirmed => {
      if (!confirmed) return;

      this.wikiService.deletePage(this.currentPage!.id).subscribe({
        next: () => {
          this.toast.success('Page deleted successfully');
          // Navigate to parent wiki overview
          const wikiSlug = this.currentPage?.wiki?.slug;
          if (wikiSlug) {
            this.router.navigate(['/wiki', wikiSlug]);
          } else {
            this.router.navigate(['/']);
          }
        },
        error: (error: any) => {
          if (error.status === 404) {
            this.toast.error('Page not found. It may have already been deleted.');
          } else {
            this.toast.error(error.error?.message || 'Failed to delete page');
          }
        }
      });
    });
  }

  /**
   * Toggle move dropdown
   */
  toggleMoveDropdown(): void {
    this.showMoveDropdown = !this.showMoveDropdown;
    this.showExportDropdown = false; // Close other dropdown
  }

  /**
   * Toggle export dropdown
   */
  toggleExportDropdown(): void {
    this.showExportDropdown = !this.showExportDropdown;
    this.showMoveDropdown = false; // Close other dropdown
  }

  /**
   * Close dropdowns (for click outside)
   */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.showMoveDropdown && !this.showExportDropdown) return; // Skip if already closed

    const target = event.target as HTMLElement;
    if (!target.closest('.dropdown-container')) {
      this.showMoveDropdown = false;
      this.showExportDropdown = false;
    }
  }

  /**
   * Export page to PDF
   */
  exportToPdf(): void {
    this.showExportDropdown = false;
    if (this.currentPage?.id) {
      this.wikiService.exportPageToPdf(this.currentPage.id);
    }
  }

  /**
   * Export page to Markdown
   */
  exportToMarkdown(): void {
    this.showExportDropdown = false;
    if (this.currentPage?.id) {
      this.wikiService.exportPageToMarkdown(this.currentPage.id);
    }
  }

  /**
   * Print the current page using browser print dialog
   */
  printPage(): void {
    this.showExportDropdown = false;
    window.print();
  }

  /**
   * Move page to a specific section (from dropdown)
   */
  movePageToSection(targetSectionId: number): void {
    this.showMoveDropdown = false;

    if (!targetSectionId || !this.currentPage) {
      return;
    }

    // Find the target section to show its name in the confirmation
    const targetSection = this.availableSections.find(s => s.id === targetSectionId);
    const targetSectionName = targetSection?.title || 'the selected section';

    this.confirmDialog.open({
      title: 'Move Page',
      message: `Move "${this.currentPage.title}" to section "${targetSectionName}"?`,
      type: 'info',
      confirmText: 'Move',
      cancelText: 'Cancel'
    }).subscribe(confirmed => {
      if (!confirmed) return;

      this.wikiService.movePage(this.currentPage!.id, targetSectionId).subscribe({
        next: (response) => {
          const updatedPage = response.data;

          if (!targetSection || !this.currentPage?.wiki?.slug) {
            window.location.reload();
            return;
          }

          this.toast.success(`Page moved to "${targetSectionName}" successfully`);

          const wikiSlug = this.currentPage.wiki.slug;
          const sectionSlug = targetSection.slug;
          const pageSlug = updatedPage.slug;

          setTimeout(() => {
            this.router.navigate(['/wiki', wikiSlug, sectionSlug, pageSlug]);
          }, 500);
        },
        error: (error: any) => {
          if (error.status === 404) {
            this.toast.error('Target section not found.');
          } else if (error.status === 403) {
            this.toast.error('You do not have permission to move this page to the selected section.');
          } else {
            this.toast.error(error.error?.message || 'Failed to move page');
          }
        }
      });
    });
  }

  /**
   * Move page to a different section (legacy - for select element)
   */
  movePage(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const targetSectionId = parseInt(select.value);

    if (!targetSectionId || !this.currentPage) {
      return;
    }

    // Find the target section to show its name in the confirmation
    const targetSection = this.availableSections.find(s => s.id === targetSectionId);
    const targetSectionName = targetSection?.title || 'the selected section';

    this.confirmDialog.open({
      title: 'Move Page',
      message: `Move "${this.currentPage.title}" to section "${targetSectionName}"?`,
      type: 'info',
      confirmText: 'Move',
      cancelText: 'Cancel'
    }).subscribe(confirmed => {
      if (!confirmed) {
        select.value = ''; // Reset dropdown on cancel
        return;
      }

      this.wikiService.movePage(this.currentPage!.id, targetSectionId).subscribe({
        next: (response) => {
          const updatedPage = response.data;

          if (!targetSection || !this.currentPage?.wiki?.slug) {
            // Fallback: reload if we can't build the URL
            window.location.reload();
            return;
          }

          this.toast.success(`Page moved to "${targetSectionName}" successfully`);

          // Navigate to the new URL
          const wikiSlug = this.currentPage.wiki.slug;
          const sectionSlug = targetSection.slug;
          const pageSlug = updatedPage.slug;

          setTimeout(() => {
            this.router.navigate(['/wiki', wikiSlug, sectionSlug, pageSlug]);
          }, 500);
        },
        error: (error: any) => {
          select.value = ''; // Reset dropdown
          if (error.status === 404) {
            this.toast.error('Target section not found.');
          } else if (error.status === 403) {
            this.toast.error('You do not have permission to move this page to the selected section.');
          } else {
            this.toast.error(error.error?.message || 'Failed to move page');
          }
        }
      });
    });
  }

  sanitizeHtml(html: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }
}
