import { Component, OnInit, OnDestroy, AfterViewChecked, ViewChild, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { WikiService } from '../../core/services/wiki.service';
import { AuthService } from '../../core/services/auth.service';
import { PageContextService } from '../../core/services/page-context.service';
import { Page } from '../../core/models/wiki.model';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Observable, throwError, EMPTY } from 'rxjs';
import { switchMap, catchError, shareReplay, tap, map, take } from 'rxjs/operators';
import { QuillEditorComponent } from '../../shared/components/quill-editor/quill-editor.component';

@Component({
  selector: 'app-wiki-page-viewer',
  imports: [CommonModule, FormsModule, RouterLink, QuillEditorComponent],
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

  // Editing state
  isEditing = false;
  isSaving = false;

  // Content management
  editableContent = '';

  // Permission checking
  canEdit$!: Observable<boolean>;

  // UI state
  saveError: string | null = null;

  // ViewChild references
  @ViewChild('quillEditor', { static: false }) quillEditor?: QuillEditorComponent;

  constructor(
    private route: ActivatedRoute,
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
            this.error = err.error?.message || 'Failed to load page';
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

    // Subscribe to canEdit$ to ensure tap executes
    this.canEdit$.subscribe();

    // Subscribe to edit state changes from header
    this.pageContext.editState$.subscribe(state => {
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
    this.cleanupScripts();
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
    const html = this.quillEditor.value;

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
        this.saveError = err.error?.message || 'Failed to save page. Please try again.';

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
    return this.quillEditor.value !== this.editableContent;
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

  sanitizeHtml(html: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }
}
