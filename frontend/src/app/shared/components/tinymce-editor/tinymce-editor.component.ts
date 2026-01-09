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

  @ViewChild('editor', { static: false }) editor?: EditorComponent;

  constructor(private ngZone: NgZone, private cdr: ChangeDetectorRef) {
    this.tinymceConfig = {
      ...TINYMCE_BASE_CONFIG,
      setup: (editor: any) => this.setupEditor(editor)
    };
  }

  ngAfterViewInit(): void {
    // TinyMCE will initialize automatically via the EditorComponent
    // The onInit event will be handled in the template
  }

  ngOnDestroy(): void {
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

    // Set initial content
    if (this._content) {
      this.editorInstance.setContent(this._content);
    }

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

    // Listen for scroll/resize to reposition overlay
    this.editorInstance.on('ScrollContent ResizeContent', () => {
      if (this.selectedImage && this.imageOverlay) {
        this.positionImageOverlay(this.editorInstance, this.selectedImage as HTMLImageElement);
      }
    });
  }

  // Editor Setup (register custom buttons)

  private setupEditor(editor: any): void {
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
    console.log('toggleSourceMode called, current isSourceMode:', this.isSourceMode);

    if (!this.isSourceMode) {
      // Switch TO source mode
      const html = this.editorInstance.getContent({ format: 'raw' });
      console.log('Switching TO source mode, HTML length:', html.length);
      this.sourceContent = this.formatHtml(html);
      console.log('Formatted HTML length:', this.sourceContent.length);
      // TinyMCE will be hidden via [hidden] directive in template
    } else {
      // Switch FROM source mode
      console.log('Switching FROM source mode, sourceContent length:', this.sourceContent.length);
      console.log('sourceContent value:', this.sourceContent.substring(0, 200));
      this.editorInstance.setContent(this.sourceContent, { format: 'raw' });
      this._content = this.sourceContent;
      this.contentChange.emit(this.sourceContent);
    }

    this.isSourceMode = !this.isSourceMode;
    console.log('After toggle, isSourceMode is now:', this.isSourceMode);

    // ✅ Force Angular to detect the change
    this.cdr.detectChanges();
  }

  onSourceChange(): void {
    console.log('onSourceChange called, sourceContent length:', this.sourceContent.length);
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
    overlay.innerHTML = `
      <div class="image-toolbar">
        <button class="img-align-btn" data-align="left" title="Align Left">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="17" y1="10" x2="3" y2="10"></line>
            <line x1="21" y1="6" x2="3" y2="6"></line>
            <line x1="21" y1="14" x2="3" y2="14"></line>
            <line x1="17" y1="18" x2="3" y2="18"></line>
          </svg>
        </button>
        <button class="img-align-btn" data-align="center" title="Align Center">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="10" x2="6" y2="10"></line>
            <line x1="21" y1="6" x2="3" y2="6"></line>
            <line x1="21" y1="14" x2="3" y2="14"></line>
            <line x1="18" y1="18" x2="6" y2="18"></line>
          </svg>
        </button>
        <button class="img-align-btn" data-align="right" title="Align Right">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="21" y1="10" x2="7" y2="10"></line>
            <line x1="21" y1="6" x2="3" y2="6"></line>
            <line x1="21" y1="14" x2="3" y2="14"></line>
            <line x1="21" y1="18" x2="7" y2="18"></line>
          </svg>
        </button>
        <span class="image-size">${img.width} × ${img.height}</span>
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
    // Remove existing alignment classes
    img.classList.remove('ql-align-left', 'ql-align-center', 'ql-align-right');

    // Add new alignment
    if (align) {
      img.classList.add(`ql-align-${align}`);
    }

    // Trigger change event
    editor.fire('change');

    // Update overlay position (image might move)
    requestAnimationFrame(() => {
      if (this.imageOverlay && this.selectedImage) {
        this.positionImageOverlay(editor, this.selectedImage);
      }
    });
  }
}
