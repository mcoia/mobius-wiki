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

@Component({
  selector: 'app-wiki-page-viewer',
  imports: [CommonModule, FormsModule, RouterLink],
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
  isSourceMode = false;
  isSaving = false;

  // Content management
  editableContent = '';
  sourceContent = '';

  // Permission checking
  canEdit$!: Observable<boolean>;

  // Selection management
  private savedSelection: Range | null = null;

  // UI state
  isInsertMenuOpen = false;
  saveError: string | null = null;

  // ViewChild references
  @ViewChild('contentArea', { static: false }) contentArea!: ElementRef<HTMLDivElement>;
  @ViewChild('sourceEditor', { static: false }) sourceEditor!: ElementRef<HTMLTextAreaElement>;
  @ViewChild('insertDropdown', { static: false }) insertDropdownRef!: ElementRef<HTMLDivElement>;

  // Element templates
  templates = {
    callout: `<div class="callout"><p>Enter your callout text here...</p></div>`,
    note: `<div class="note-box"><p><strong>Note:</strong> Enter your note text here...</p></div>`,
    stats: `<div class="stats-grid">
    <div class="stat-card"><div class="stat-number">00</div><div class="stat-label">Label One</div></div>
    <div class="stat-card"><div class="stat-number">00</div><div class="stat-label">Label Two</div></div>
    <div class="stat-card"><div class="stat-number">00</div><div class="stat-label">Label Three</div></div>
  </div>`,
    h1: `<h1>New Page Title</h1>`,
    h2: `<h2>New Section Heading</h2>`,
    h3: `<h3>New Subsection Heading</h3>`,
    paragraph: `<p>Enter your paragraph text here...</p>`,
    ul: `<ul>
    <li><strong>Item one</strong> – Description</li>
    <li><strong>Item two</strong> – Description</li>
    <li><strong>Item three</strong> – Description</li>
  </ul>`,
    ol: `<ol>
    <li><strong>First step</strong> – Description</li>
    <li><strong>Second step</strong> – Description</li>
    <li><strong>Third step</strong> – Description</li>
  </ol>`,
    table: `<table class="timeline-table">
    <thead><tr><th style="width:120px">Column 1</th><th>Column 2</th></tr></thead>
    <tbody>
      <tr><td><strong>Row 1</strong></td><td>Description for row 1</td></tr>
      <tr><td><strong>Row 2</strong></td><td>Description for row 2</td></tr>
      <tr><td><strong>Row 3</strong></td><td>Description for row 3</td></tr>
    </tbody>
  </table>`,
    divider: `<hr style="border: none; border-top: 1px solid #e0e0e0; margin: 32px 0;">`
  };

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

    // IMPORTANT: Use setTimeout to ensure Angular has removed the @if block
    // before we manually set innerHTML
    setTimeout(() => {
      if (this.contentArea) {
        // Manually set innerHTML from the current page data
        // This happens ONCE, then the DOM stays static during editing
        this.contentArea.nativeElement.innerHTML = this.currentPage?.content || '';

        // Store original content for dirty checking
        this.editableContent = this.contentArea.nativeElement.innerHTML;
      }
    }, 0);
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

    // Exit source mode if active
    if (this.isSourceMode) {
      this.isSourceMode = false;
    }

    // Clear the manually-set content so Angular can take over again
    if (this.contentArea) {
      this.contentArea.nativeElement.innerHTML = '';
    }
  }

  /**
   * Perform save operation (triggered by header save button)
   */
  private performSave(): void {
    if (this.isSaving) return;

    this.isSaving = true;
    this.saveError = null;

    // Get HTML from content area or source editor
    let html: string;
    if (this.isSourceMode) {
      html = this.sourceContent;
    } else {
      html = this.contentArea.nativeElement.innerHTML;
    }

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
    if (!this.contentArea) return false;

    const currentContent = this.isSourceMode
      ? this.sourceContent
      : this.contentArea.nativeElement.innerHTML;

    return currentContent !== this.editableContent;
  }

  /**
   * Toggle between visual and HTML editing
   */
  toggleSourceMode(): void {
    if (!this.isEditing) return;

    this.isSourceMode = !this.isSourceMode;

    if (this.isSourceMode) {
      // Switch to source mode
      this.sourceContent = this.formatHTML(this.contentArea.nativeElement.innerHTML);
    } else {
      // Switch back to visual mode
      this.contentArea.nativeElement.innerHTML = this.sourceContent;
    }
  }

  /**
   * Format HTML for source editor
   */
  formatHTML(html: string): string {
    let formatted = '';
    let indent = 0;
    const tab = '  ';

    html = html.replace(/>\s*</g, '>\n<');
    const lines = html.split('\n');

    lines.forEach(line => {
      line = line.trim();
      if (!line) return;

      if (line.match(/^<\/\w/)) {
        indent = Math.max(0, indent - 1);
      }

      formatted += tab.repeat(indent) + line + '\n';

      if (line.match(/^<\w[^>]*[^\/]>.*$/)) {
        if (!line.match(/<(br|hr|img|input|meta|link|area|base|col|embed|param|source|track|wbr)[^>]*>/i) &&
            !line.match(/<\/\w+>$/)) {
          indent++;
        }
      }
    });

    return formatted.trim();
  }

  /**
   * Wrapper for document.execCommand
   */
  execCmd(command: string, value: string | null = null): void {
    if (this.isSourceMode) return;
    document.execCommand(command, false, value || undefined);
    this.contentArea.nativeElement.focus();
  }

  /**
   * Prompt for URL and insert link
   */
  insertLink(): void {
    if (this.isSourceMode) return;
    const url = prompt('Enter URL:', 'https://');
    if (url) {
      this.execCmd('createLink', url);
    }
  }

  /**
   * Save current selection
   */
  saveSelection(): void {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      this.savedSelection = sel.getRangeAt(0).cloneRange();
    }
  }

  /**
   * Restore saved selection
   */
  restoreSelection(): void {
    if (this.savedSelection) {
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(this.savedSelection);
      }
    }
  }

  /**
   * Insert template at cursor
   */
  insertElement(html: string): void {
    if (this.isSourceMode) return;

    this.restoreSelection();

    const selection = window.getSelection();
    let inserted = false;

    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const contentEl = this.contentArea.nativeElement;

      if (contentEl.contains(range.commonAncestorContainer)) {
        let node: Node | null = range.commonAncestorContainer;
        while (node && node !== contentEl && node.parentNode !== contentEl) {
          node = node.parentNode;
        }

        if (node && node !== contentEl && node instanceof HTMLElement) {
          node.insertAdjacentHTML('afterend', html);
          inserted = true;
        }
      }
    }

    if (!inserted) {
      const footer = this.contentArea.nativeElement.querySelector('.content-footer, .page-meta');
      if (footer) {
        footer.insertAdjacentHTML('beforebegin', html);
      } else {
        this.contentArea.nativeElement.insertAdjacentHTML('beforeend', html);
      }
    }

    this.contentArea.nativeElement.focus();
  }

  /**
   * Handle pasted content
   */
  handlePaste(event: ClipboardEvent): void {
    event.preventDefault();

    const clipboardData = event.clipboardData;
    if (!clipboardData) return;

    const items = clipboardData.items;
    let html = clipboardData.getData('text/html');
    const text = clipboardData.getData('text/plain');

    // Check for image files
    let hasImageFile = false;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          hasImageFile = true;
          const file = items[i].getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
              const img = `<img src="${e.target?.result}" style="max-width: 100%; height: auto; display: block; margin: 16px 0;">`;
              document.execCommand('insertHTML', false, img);
            };
            reader.readAsDataURL(file);
          }
          break;
        }
      }
    }

    if (!hasImageFile) {
      if (html) {
        // Clean HTML
        const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
        if (bodyMatch) {
          html = bodyMatch[1];
        }

        html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        html = html.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
        html = html.replace(/<meta[^>]*>/gi, '');
        html = html.replace(/<link[^>]*>/gi, '');
        html = html.replace(/<!--StartFragment-->/gi, '');
        html = html.replace(/<!--EndFragment-->/gi, '');

        html = html.replace(/<img([^>]*)>/gi, (match, attrs) => {
          if (!attrs.includes('style=')) {
            return `<img${attrs} style="max-width: 100%; height: auto;">`;
          } else {
            return match.replace(/style="([^"]*)"/, 'style="$1; max-width: 100%; height: auto;"');
          }
        });

        document.execCommand('insertHTML', false, html);
      } else if (text) {
        document.execCommand('insertText', false, text);
      }
    }
  }

  /**
   * Handle keyboard shortcuts
   */
  @HostListener('document:keydown', ['$event'])
  handleKeyboard(event: KeyboardEvent): void {
    if (!this.isEditing || this.isSourceMode) return;

    if (event.ctrlKey || event.metaKey) {
      switch (event.key.toLowerCase()) {
        case 'b':
          event.preventDefault();
          this.execCmd('bold');
          break;
        case 'i':
          event.preventDefault();
          this.execCmd('italic');
          break;
        case 'u':
          event.preventDefault();
          this.execCmd('underline');
          break;
      }
    }
  }

  /**
   * Handle click outside to close insert menu
   */
  @HostListener('document:click', ['$event'])
  handleDocumentClick(event: MouseEvent): void {
    if (this.isInsertMenuOpen &&
        this.insertDropdownRef &&
        !this.insertDropdownRef.nativeElement.contains(event.target as Node)) {
      this.isInsertMenuOpen = false;
    }
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
