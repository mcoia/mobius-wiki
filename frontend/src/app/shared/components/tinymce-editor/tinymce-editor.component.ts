import {
  Component,
  Input,
  Output,
  EventEmitter,
  AfterViewInit,
  OnDestroy,
  NgZone,
  ViewChild,
  ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EditorComponent, EditorModule, TINYMCE_SCRIPT_SRC } from '@tinymce/tinymce-angular';
import { html as beautifyHtml } from 'js-beautify';
import {
  TINYMCE_BASE_CONFIG,
  ELEMENT_TEMPLATES,
  HTML_BEAUTIFY_OPTIONS
} from './tinymce-config';

@Component({
  selector: 'app-quill-editor',  // Keep same selector for compatibility
  standalone: true,
  imports: [CommonModule, FormsModule, EditorModule],
  providers: [
    { provide: TINYMCE_SCRIPT_SRC, useValue: 'tinymce/tinymce.min.js' }  // ✅ Force self-hosted
  ],
  templateUrl: './tinymce-editor.component.html',
  styleUrls: ['./tinymce-editor.component.css']
})
export class TinymceEditorComponent implements AfterViewInit, OnDestroy {
  // Inputs (must match Quill API)
  private _content: string = '';

  @Input() set content(value: string) {
    this._content = value || '';

    // Update editor if already initialized
    if (this.editorInstance && !this.isSourceMode) {
      this.editorInstance.setContent(this._content);
    } else if (this.isSourceMode) {
      this.sourceContent = this._content;
    }
  }

  get content(): string {
    return this._content;
  }

  @Input() placeholder: string = 'Start writing...';

  // Outputs (must match Quill API)
  @Output() contentChange = new EventEmitter<string>();

  // Component state
  isSourceMode = false;
  sourceContent = '';
  tinymceConfig: any;
  private editorInstance: any = null;
  private imageOverlay: HTMLDivElement | null = null;
  private selectedImage: HTMLImageElement | null = null;
  private resizeHandler?: () => void;

  @ViewChild('editor', { static: false }) editor?: EditorComponent;

  constructor(private ngZone: NgZone, private cdr: ChangeDetectorRef) {
    this.tinymceConfig = {
      ...TINYMCE_BASE_CONFIG,
      setup: (editor: any) => this.setupEditor(editor)
    };
  }

  ngAfterViewInit(): void {
    // Calculate and set editor height to fill available space
    setTimeout(() => {
      this.updateEditorHeight();
    }, 100);

    // Update on window resize
    this.resizeHandler = () => this.updateEditorHeight();
    window.addEventListener('resize', this.resizeHandler);
  }

  private updateEditorHeight(): void {
    if (this.editorInstance) {
      // Calculate available height
      const viewportHeight = window.innerHeight;
      const headerHeight = 48; // Top header
      const breadcrumbEl = document.querySelector('.breadcrumb');
      const breadcrumbHeight = breadcrumbEl ? breadcrumbEl.clientHeight + 56 : 100; // Include margins
      const padding = 40; // Bottom padding

      const availableHeight = viewportHeight - headerHeight - breadcrumbHeight - padding;
      const editorHeight = Math.max(400, availableHeight); // Minimum 400px

      // Set height on the TinyMCE container via DOM
      const editorContainer = this.editorInstance.getContainer();
      if (editorContainer) {
        editorContainer.style.height = editorHeight + 'px';
      }
    }
  }

  ngOnDestroy(): void {
    // Remove resize listener
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
      this.resizeHandler = undefined;
    }

    // Remove image overlay
    this.hideImageOverlay();

    // Destroy TinyMCE instance
    if (this.editorInstance) {
      this.editorInstance.destroy();
      this.editorInstance = null;
    }

    this.selectedImage = null;
  }

  // Public API Methods (must match Quill)

  getValue(): string {
    if (this.isSourceMode) {
      return this.sourceContent;
    }

    return this.editorInstance?.getContent() || '';
  }

  undo(): void {
    this.editorInstance?.execCommand('Undo');
  }

  redo(): void {
    this.editorInstance?.execCommand('Redo');
  }

  // TinyMCE Event Handlers

  onEditorInit(event: any): void {
    this.editorInstance = event.editor;

    // Inject Google Fonts into TinyMCE iframe for real-time font preview
    const iframeDoc = this.editorInstance.getDoc();
    if (iframeDoc) {
      const link = iframeDoc.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Crimson+Text:wght@400;600&family=Lato:wght@400;700&family=Merriweather:wght@400;700&family=Outfit:wght@300;400;500&family=Poppins:wght@300;400;500;600&family=Roboto:wght@400;500&family=Source+Serif+4:wght@400;600&display=swap';
      iframeDoc.head.appendChild(link);
    }

    // Set initial content
    if (this._content) {
      this.editorInstance.setContent(this._content);
    }

    // Set full height after initialization
    setTimeout(() => {
      this.updateEditorHeight();
    }, 100);

    // Listen for content changes
    this.editorInstance.on('change input', () => {
      this.ngZone.run(() => {
        const html = this.editorInstance.getContent();
        this._content = html;
        this.contentChange.emit(html);
      });
    });

    // Listen for image selection (for alignment overlay)
    this.editorInstance.on('NodeChange', (e: any) => {
      if (e.element.nodeName === 'IMG') {
        this.selectedImage = e.element;
        this.showImageOverlay(this.editorInstance, this.selectedImage as HTMLImageElement);
      } else {
        this.hideImageOverlay();
        this.selectedImage = null;
      }
    });

    // Hide overlay when clicking elsewhere in editor
    this.editorInstance.on('click', (e: any) => {
      if (e.target.nodeName !== 'IMG' && this.imageOverlay) {
        this.hideImageOverlay();
        this.selectedImage = null;
      }
    });

    // Listen for scroll/resize to reposition overlay
    this.editorInstance.on('ScrollContent ResizeContent', () => {
      if (this.selectedImage && this.imageOverlay) {
        this.positionImageOverlay(this.editorInstance, this.selectedImage as HTMLImageElement);
      }
    });
  }

  // Editor Setup (register custom buttons)

  private setupEditor(editor: any): void {
    // Register H1, H2, H3 heading buttons for TOC-friendly content
    const headingButtons = [
      { id: 'heading1', level: 'h1', text: 'H1', tooltip: 'Heading 1 - Page Title' },
      { id: 'heading2', level: 'h2', text: 'H2', tooltip: 'Heading 2 - Section' },
      { id: 'heading3', level: 'h3', text: 'H3', tooltip: 'Heading 3 - Subsection' }
    ];

    headingButtons.forEach(({ id, level, text, tooltip }) => {
      editor.ui.registry.addButton(id, {
        text,
        tooltip,
        onAction: () => this.insertElement(editor, level)
      });
    });

    // Register custom HTML source toggle button
    editor.ui.registry.addToggleButton('sourcecode', {
      icon: 'sourcecode',  // TinyMCE built-in code icon
      tooltip: 'HTML Source',
      onAction: () => {
        this.ngZone.run(() => {
          this.toggleSourceMode();
        });
      },
      onSetup: (api: any) => {
        // Sync button state with isSourceMode
        const updateState = () => {
          api.setActive(this.isSourceMode);
        };

        updateState();  // Initial state
        editor.on('SourceModeChange', updateState);

        return () => editor.off('SourceModeChange', updateState);
      }
    });

    // Register custom "Insert" menu button
    editor.ui.registry.addMenuButton('insertmenu', {
      text: 'Insert',
      fetch: (callback: any) => {
        callback([
          {
            type: 'menuitem',
            text: 'Callout Box',
            onAction: () => this.insertElement(editor, 'callout')
          },
          {
            type: 'menuitem',
            text: 'Note Box',
            onAction: () => this.insertElement(editor, 'note')
          },
          {
            type: 'menuitem',
            text: 'Stats Grid',
            onAction: () => this.insertElement(editor, 'stats')
          },
          {
            type: 'separator'
          },
          {
            type: 'menuitem',
            text: 'Heading 1',
            onAction: () => this.insertElement(editor, 'h1')
          },
          {
            type: 'menuitem',
            text: 'Heading 2',
            onAction: () => this.insertElement(editor, 'h2')
          },
          {
            type: 'menuitem',
            text: 'Heading 3',
            onAction: () => this.insertElement(editor, 'h3')
          },
          {
            type: 'menuitem',
            text: 'Paragraph',
            onAction: () => this.insertElement(editor, 'paragraph')
          },
          {
            type: 'separator'
          },
          {
            type: 'menuitem',
            text: 'Unordered List',
            onAction: () => this.insertElement(editor, 'ul')
          },
          {
            type: 'menuitem',
            text: 'Ordered List',
            onAction: () => this.insertElement(editor, 'ol')
          },
          {
            type: 'separator'
          },
          {
            type: 'menuitem',
            text: 'Divider',
            onAction: () => this.insertElement(editor, 'divider')
          }
        ]);
      }
    });

    // Code block triggers: ``` (Markdown) or ---- (AsciiDoc)
    // These aren't supported by textpattern plugin, so we handle manually
    editor.on('input', () => {
      const node = editor.selection.getNode();
      if (node.nodeName === 'P') {
        const text = node.textContent?.trim();
        if (text === '```' || text === '----') {
          editor.undoManager.transact(() => {
            editor.dom.remove(node);
            editor.insertContent('<pre><code>\n</code></pre>');
            // Position cursor inside code block
            const pres = editor.dom.select('pre');
            const pre = pres[pres.length - 1];
            if (pre?.firstChild) {
              editor.selection.setCursorLocation(pre.firstChild, 0);
            }
          });
        }
      }
    });

    // Shift+Enter inside code block = exit to new paragraph
    editor.on('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' && e.shiftKey) {
        const node = editor.selection.getNode();
        // Check if we're inside a code block (pre or code element)
        const preBlock = editor.dom.getParent(node, 'pre');
        if (preBlock) {
          e.preventDefault();
          editor.undoManager.transact(() => {
            // Create new paragraph after the pre block
            const p = editor.dom.create('p', {}, '<br>');
            editor.dom.insertAfter(p, preBlock);
            // Move cursor to the new paragraph
            editor.selection.setCursorLocation(p, 0);
          });
        }
      }
    });
  }

  // Insert Element Template

  private insertElement(editor: any, type: string): void {
    const html = ELEMENT_TEMPLATES[type];
    if (html) {
      editor.insertContent(html);
      // Trigger change event
      editor.fire('change');
    }
  }

  // Source Mode Toggle

  toggleSourceMode(): void {
    if (!this.isSourceMode) {
      // Switch TO source mode
      const html = this.editorInstance.getContent({ format: 'raw' });
      this.sourceContent = this.formatHtml(html);
      // TinyMCE will be hidden via *ngIf directive in template
    } else {
      // Switch FROM source mode
      this.editorInstance.setContent(this.sourceContent, { format: 'raw' });
      this._content = this.sourceContent;
      this.contentChange.emit(this.sourceContent);
    }

    this.isSourceMode = !this.isSourceMode;

    // ✅ Emit custom event to sync button state
    if (this.editorInstance) {
      this.editorInstance.fire('SourceModeChange');
    }

    // ✅ Force Angular to detect the change
    this.cdr.detectChanges();
  }

  onSourceChange(): void {
    this._content = this.sourceContent;
    this.contentChange.emit(this.sourceContent);
  }

  private formatHtml(html: string): string {
    try {
      // Beautify HTML for readability
      let formatted = beautifyHtml(html, HTML_BEAUTIFY_OPTIONS);

      // Normalize &nbsp; to spaces for better readability in source mode
      formatted = formatted.replace(/&nbsp;/g, ' ');

      return formatted;
    } catch (e) {
      console.error('HTML beautify failed:', e);
      return html;
    }
  }

  // Image Alignment Overlay

  private showImageOverlay(editor: any, img: HTMLImageElement): void {
    // Remove existing overlay
    this.hideImageOverlay();

    // Create new overlay
    const overlay = document.createElement('div');
    overlay.className = 'tinymce-image-overlay';

    // CRITICAL: Apply inline styles for pointer-events (component CSS doesn't reach here!)
    overlay.style.position = 'absolute';
    overlay.style.pointerEvents = 'none';  // Overlay doesn't block clicks
    overlay.style.border = '2px solid #0097A7';
    overlay.style.boxSizing = 'border-box';
    overlay.style.zIndex = '1000';

    overlay.innerHTML = `
      <div class="image-toolbar" style="position: absolute; top: -40px; left: 0; display: flex; gap: 4px; background: rgba(0, 0, 0, 0.8); border-radius: 4px; padding: 4px; pointer-events: auto;">
        <button class="img-align-btn" data-align="left" title="Align Left" style="width: 32px; height: 32px; padding: 6px; background: transparent; border: none; color: white; cursor: pointer; border-radius: 3px; display: flex; align-items: center; justify-content: center;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px;">
            <line x1="17" y1="10" x2="3" y2="10"></line>
            <line x1="21" y1="6" x2="3" y2="6"></line>
            <line x1="21" y1="14" x2="3" y2="14"></line>
            <line x1="17" y1="18" x2="3" y2="18"></line>
          </svg>
        </button>
        <button class="img-align-btn" data-align="center" title="Align Center" style="width: 32px; height: 32px; padding: 6px; background: transparent; border: none; color: white; cursor: pointer; border-radius: 3px; display: flex; align-items: center; justify-content: center;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px;">
            <line x1="18" y1="10" x2="6" y2="10"></line>
            <line x1="21" y1="6" x2="3" y2="6"></line>
            <line x1="21" y1="14" x2="3" y2="14"></line>
            <line x1="18" y1="18" x2="6" y2="18"></line>
          </svg>
        </button>
        <button class="img-align-btn" data-align="right" title="Align Right" style="width: 32px; height: 32px; padding: 6px; background: transparent; border: none; color: white; cursor: pointer; border-radius: 3px; display: flex; align-items: center; justify-content: center;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px;">
            <line x1="21" y1="10" x2="7" y2="10"></line>
            <line x1="21" y1="6" x2="3" y2="6"></line>
            <line x1="21" y1="14" x2="3" y2="14"></line>
            <line x1="21" y1="18" x2="7" y2="18"></line>
          </svg>
        </button>
        <span class="image-size" style="display: flex; align-items: center; padding: 0 8px; color: white; font-size: 12px; white-space: nowrap; pointer-events: none;">${img.width} × ${img.height}</span>
      </div>
    `;

    // Attach to editor container
    const container = editor.getContainer();
    container.appendChild(overlay);

    // Position overlay
    this.positionImageOverlay(editor, img);

    // Attach event listeners
    overlay.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const align = (btn as HTMLElement).dataset['align'];
        if (align) {
          this.alignImage(editor, img, align);
        }
      });
    });

    this.imageOverlay = overlay;
  }

  private hideImageOverlay(): void {
    if (this.imageOverlay) {
      this.imageOverlay.remove();
      this.imageOverlay = null;
    }
  }

  private positionImageOverlay(editor: any, img: HTMLImageElement): void {
    if (!this.imageOverlay) return;

    const editorRect = editor.getContainer().getBoundingClientRect();
    const imgRect = img.getBoundingClientRect();

    this.imageOverlay.style.position = 'absolute';
    this.imageOverlay.style.left = `${imgRect.left - editorRect.left}px`;
    this.imageOverlay.style.top = `${imgRect.top - editorRect.top}px`;
    this.imageOverlay.style.width = `${imgRect.width}px`;
    this.imageOverlay.style.height = `${imgRect.height}px`;

    // Update size display
    const sizeEl = this.imageOverlay.querySelector('.image-size');
    if (sizeEl) {
      sizeEl.textContent = `${Math.round(imgRect.width)} × ${Math.round(imgRect.height)}`;
    }
  }

  private alignImage(editor: any, img: HTMLImageElement, align: string): void {
    // Clear existing alignment styles
    img.style.display = '';
    img.style.marginLeft = '';
    img.style.marginRight = '';

    // Apply new alignment using inline styles (matches toolbar behavior)
    if (align === 'left') {
      img.style.display = 'block';
      img.style.marginLeft = '0';
      img.style.marginRight = 'auto';
    } else if (align === 'center') {
      img.style.display = 'block';
      img.style.marginLeft = 'auto';
      img.style.marginRight = 'auto';
    } else if (align === 'right') {
      img.style.display = 'block';
      img.style.marginLeft = 'auto';
      img.style.marginRight = '0';
    }

    // Trigger change event
    editor.fire('change');

    // Hide overlay after alignment to prevent lockup
    this.hideImageOverlay();
    this.selectedImage = null;
  }
}
