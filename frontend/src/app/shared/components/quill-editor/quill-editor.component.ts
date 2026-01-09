import { Component, Input, Output, EventEmitter, NgZone, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { QuillModule } from 'ngx-quill';
import Quill from 'quill';
import { html as beautifyHtml } from 'js-beautify';

// Import Parchment to register custom attributes
const Parchment: any = Quill.import('parchment');

// Allow 'class' attribute on any blot
const ClassAttr = new Parchment.Attributor('class', 'class', {
  scope: Parchment.Scope.ANY
});
Quill.register(ClassAttr, true);

// Allow 'style' attribute on any blot (for inline styles)
const StyleAttr = new Parchment.Attributor('style', 'style', {
  scope: Parchment.Scope.ANY
});
Quill.register(StyleAttr, true);

// Register 'div' as a Block blot so it's not converted to 'p'
const Block: any = Quill.import('blots/block');
class DivBlock extends Block {
  static blotName = 'div-block';
  static tagName = 'div';

  static create(value: any) {
    const node = super.create(value);
    return node;
  }
}
Quill.register(DivBlock, true);

// Extend Quill's Image format to preserve 'class' attribute for alignment
const Image: any = Quill.import('formats/image');
const ATTRIBUTES = ['alt', 'height', 'width', 'class'];

class ImageBlot extends Image {
  static create(value: any) {
    // Quill expects value to be the src string for the image
    const src = typeof value === 'string' ? value : value.src;
    const node = super.create(src);

    // Apply alignment class if present in the value object
    if (typeof value === 'object' && value.align) {
      node.setAttribute('class', `ql-align-${value.align}`);
    }

    // Also restore other attributes if they exist in the value object
    if (typeof value === 'object') {
      if (value.alt) node.setAttribute('alt', value.alt);
      if (value.width) node.setAttribute('width', value.width);
      if (value.height) node.setAttribute('height', value.height);
    }

    return node;
  }

  static formats(node: HTMLImageElement) {
    // We need to return an object that contains the src,
    // so that when this Delta is rendered back, create(value) gets the src.
    // However, Quill's default Image.formats(node) might just return attributes or be null.
    // We should check what super.formats returns.
    // Actually, Image blot value() usually returns the src string.
    // We are overriding value() to return formats().

    const formats: any = {
      src: node.getAttribute('src')
    };

    if (node.hasAttribute('alt')) formats.alt = node.getAttribute('alt');
    if (node.hasAttribute('width')) formats.width = node.getAttribute('width');
    if (node.hasAttribute('height')) formats.height = node.getAttribute('height');

    if (node.classList.contains('ql-align-left')) {
      formats.align = 'left';
    } else if (node.classList.contains('ql-align-center')) {
      formats.align = 'center';
    } else if (node.classList.contains('ql-align-right')) {
      formats.align = 'right';
    }

    return formats;
  }


  static value(node: HTMLImageElement) {
    return this['formats'](node);
  }

  format(name: string, value: any) {
    if (name === 'align') {
      if (value) {
        this['domNode'].classList.remove('ql-align-left', 'ql-align-center', 'ql-align-right');
        this['domNode'].classList.add(`ql-align-${value}`);
      } else {
        this['domNode'].classList.remove('ql-align-left', 'ql-align-center', 'ql-align-right');
      }
    } else {
      super.format(name, value);
    }
  }
}

// Register custom Image blot with Quill
Quill.register('formats/image', ImageBlot, true);

@Component({
  selector: 'app-quill-editor',
  imports: [CommonModule, FormsModule, QuillModule],
  templateUrl: './quill-editor.component.html',
  styleUrl: './quill-editor.component.css'
})
export class QuillEditorComponent implements OnDestroy {
  @Input() set content(value: string) {
    if (value !== this.value) {
      this.value = value || '';
    }
  }
  @Input() placeholder: string = 'Start writing...';
  @Output() contentChange = new EventEmitter<string>();

  value: string = '';
  disabled: boolean = false;
  showInsertMenu: boolean = false;
  isSourceMode: boolean = false;

  // Reference to Quill instance
  private quillEditor: any;

  // Event Listeners
  private onDocumentClick: (e: Event) => void = () => {};
  private onWindowResize: () => void = () => {};
  private onInsertMenuOutsideClick: () => void = () => {};
  
  // Resize Listeners
  private onResizeMouseMove: ((e: MouseEvent) => void) | null = null;
  private onResizeMouseUp: (() => void) | null = null;

  // Image manipulation state
  private selectedImage: HTMLImageElement | null = null;
  private resizeOverlay: HTMLDivElement | null = null;

  // Quill configuration - use custom toolbar element
  quillConfig = {
    toolbar: '#quill-toolbar'
  };

  // Element templates based on page styles
  elementTemplates: {[key: string]: string} = {
    callout: `<div class="callout">Enter your callout text here. This is used for important highlights.</div>`,
    note: `<div class="note-box"><strong>Note:</strong> Enter your note text here. This is used for additional information.</div>`,
    stats: `<div class="stats-grid">
        <div class="stat-card"><div class="stat-number">72</div><div class="stat-label">Member Libraries</div></div>
        <div class="stat-card"><div class="stat-number">30M+</div><div class="stat-label">Items in Catalog</div></div>
        <div class="stat-card"><div class="stat-number">176+</div><div class="stat-label">Physical Branches</div></div>
    </div>`,
    h1: `<h1>New Page Title</h1>`,
    h2: `<h2>New Section Heading</h2>`,
    h3: `<h3>New Subsection Heading</h3>`,
    paragraph: `<p>Enter your paragraph text here. This is standard body text with comfortable line height and spacing.</p>`,
    ul: `<ul>
        <li><strong>Item one</strong> – Description of the first item</li>
        <li><strong>Item two</strong> – Description of the second item</li>
        <li><strong>Item three</strong> – Description of the third item</li>
    </ul>`,
    ol: `<ol>
        <li><strong>First step</strong> – Description of step one</li>
        <li><strong>Second step</strong> – Description of step two</li>
        <li><strong>Third step</strong> – Description of step three</li>
    </ol>`,
    divider: `<hr style="border: none; border-top: 1px solid #e0e0e0; margin: 32px 0;">`
  };

  // js-beautify configuration for HTML formatting
  private readonly htmlBeautifyOptions = {
    indent_size: 2,
    indent_char: ' ',
    indent_with_tabs: false,
    wrap_line_length: 100,
    wrap_attributes: 'auto' as 'auto',
    wrap_attributes_indent_size: 2,
    preserve_newlines: true,
    max_preserve_newlines: 2,
    end_with_newline: false,
    indent_inner_html: true,
    indent_scripts: 'keep' as 'keep',
    unformatted: [],
    content_unformatted: ['pre', 'textarea'],
    extra_liners: [],
    indent_empty_lines: false,
    templating: ['angular'],
    void_elements: [
      'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
      'link', 'meta', 'param', 'source', 'track', 'wbr'
    ]
  };

  constructor(private ngZone: NgZone) {}

  ngOnDestroy(): void {
    // Clean up global event listeners
    document.removeEventListener('click', this.onInsertMenuOutsideClick);
    document.removeEventListener('click', this.onDocumentClick);
    window.removeEventListener('resize', this.onWindowResize);

    // Clean up any active resize listeners
    if (this.onResizeMouseMove) {
      document.removeEventListener('mousemove', this.onResizeMouseMove);
    }
    if (this.onResizeMouseUp) {
      document.removeEventListener('mouseup', this.onResizeMouseUp);
    }
  }

  onContentChanged(event: any): void {
    const html = event.html;
    this.value = html;
    this.contentChange.emit(html);
  }

  getValue(): string {
    return this.quillEditor?.root?.innerHTML || '';
  }

  onEditorCreated(quill: any): void {
    this.quillEditor = quill;
    this.setupImageHandling();

    // Close insert menu when clicking elsewhere
    this.onInsertMenuOutsideClick = () => {
      this.ngZone.run(() => {
        this.showInsertMenu = false;
      });
    };
    document.addEventListener('click', this.onInsertMenuOutsideClick);
  }

  private setupImageHandling(): void {
    if (!this.quillEditor) return;

    const editor = this.quillEditor.root;

    // Listen for clicks on images
    editor.addEventListener('click', (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'IMG') {
        e.preventDefault();
        this.selectImage(target as HTMLImageElement);
      } else {
        this.deselectImage();
      }
    });

    // Listen for clicks outside editor to deselect
    this.onDocumentClick = (e: Event) => {
      if (!editor.contains(e.target as Node)) {
        this.deselectImage();
      }
    };
    document.addEventListener('click', this.onDocumentClick);

    // Update overlay on content changes (e.g. alignment via toolbar)
    this.quillEditor.on('text-change', () => {
      if (this.selectedImage) {
        this.positionOverlay(this.selectedImage);
      }
    });

    // Update overlay on selection change (handles keyboard navigation)
    this.quillEditor.on('selection-change', (range: any) => {
      if (!range && this.selectedImage) {
        // Blur occurred, but we might want to keep selection if clicking overlay
        return;
      }

      // If selection moved away from the image, deselect it
      if (this.selectedImage && range) {
        const blot = Quill.find(this.selectedImage);
        if (blot) {
          const index = this.quillEditor.getIndex(blot);
          if (range.index !== index || range.length !== 1) {
            this.deselectImage();
          }
        }
      }
    });

    // Handle window resize
    this.onWindowResize = () => {
      if (this.selectedImage) {
        this.positionOverlay(this.selectedImage);
      }
    };
    window.addEventListener('resize', this.onWindowResize);

    // Handle scroll in the editor container
    this.quillEditor.root.addEventListener('scroll', () => {
      if (this.selectedImage) {
        this.positionOverlay(this.selectedImage);
      }
    }, true);

    // Intercept main toolbar alignment clicks when an image is selected
    const toolbar = document.querySelector('#quill-toolbar');
    if (toolbar) {
      toolbar.querySelectorAll('.ql-align').forEach(btn => {
        btn.addEventListener('click', (e) => {
          if (this.selectedImage) {
            // Prevent default Quill behavior which might try to wrap the image
            // We want to apply our custom class logic instead
            e.preventDefault();
            e.stopPropagation();

            const value = (btn as any).value;
            // Map value: "" -> "left", "center" -> "center", "right" -> "right"
            const align = value === '' ? 'left' : value;
            this.alignImage(align);
          }
        }, true); // Use capture phase to intercept before Quill
      });
    }
  }

  private selectImage(img: HTMLImageElement): void {
    this.selectedImage = img;
    this.showImageControls(img);

    // Set Quill selection to the image so toolbar buttons work
    const blot = Quill.find(img);
    if (blot && this.quillEditor) {
      const index = this.quillEditor.getIndex(blot);
      this.quillEditor.setSelection(index, 1, 'user');
    }
  }

  private deselectImage(): void {
    this.selectedImage = null;
    this.hideImageControls();
  }

  private showImageControls(img: HTMLImageElement): void {
    // Create overlay if it doesn't exist
    if (!this.resizeOverlay) {
      this.resizeOverlay = this.createResizeOverlay();
      this.quillEditor.root.parentElement?.appendChild(this.resizeOverlay);
    }

    // Position overlay over image
    this.positionOverlay(img);
    this.resizeOverlay.style.display = 'block';
  }

  private hideImageControls(): void {
    if (this.resizeOverlay) {
      this.resizeOverlay.style.display = 'none';
    }
  }

  private createResizeOverlay(): HTMLDivElement {
    const overlay = document.createElement('div');
    overlay.className = 'image-resize-overlay';
    overlay.innerHTML = `
      <div class="resize-handle resize-handle-tl"></div>
      <div class="resize-handle resize-handle-tr"></div>
      <div class="resize-handle resize-handle-bl"></div>
      <div class="resize-handle resize-handle-br"></div>
      <div class="image-toolbar">
        <button type="button" class="img-align-btn" data-align="left" title="Align Left">
          <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <line x1="9" y1="9" x2="9" y2="15"/>
          </svg>
        </button>
        <button type="button" class="img-align-btn" data-align="center" title="Align Center">
          <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <line x1="12" y1="9" x2="12" y2="15"/>
          </svg>
        </button>
        <button type="button" class="img-align-btn" data-align="right" title="Align Right">
          <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <line x1="15" y1="9" x2="15" y2="15"/>
          </svg>
        </button>
        <span class="image-size"></span>
      </div>
    `;

    // Add event listeners for alignment buttons
    overlay.querySelectorAll('.img-align-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const align = (btn as HTMLElement).getAttribute('data-align');
        this.alignImage(align || '');
      });
    });

    // Add event listeners for resize handles
    this.setupResizeHandles(overlay);

    return overlay;
  }

  private positionOverlay(img: HTMLImageElement): void {
    if (!this.resizeOverlay) return;

    const rect = img.getBoundingClientRect();
    const editorRect = this.quillEditor.root.getBoundingClientRect();

    this.resizeOverlay.style.position = 'absolute';
    this.resizeOverlay.style.left = `${rect.left - editorRect.left}px`;
    this.resizeOverlay.style.top = `${rect.top - editorRect.top}px`;
    this.resizeOverlay.style.width = `${rect.width}px`;
    this.resizeOverlay.style.height = `${rect.height}px`;

    // Update size display
    const sizeDisplay = this.resizeOverlay.querySelector('.image-size');
    if (sizeDisplay) {
      sizeDisplay.textContent = `${Math.round(rect.width)} × ${Math.round(rect.height)}`;
    }
  }

  private alignImage(alignment: string): void {
    if (!this.selectedImage || !this.quillEditor) return;

    // Find the blot for the selected image
    const blot: any = Quill.find(this.selectedImage);
    if (blot) {
      // Call the blot's format method directly.
      // This bypasses Quill's global 'align' whitelist check which filters out 'left'.
      blot.format('align', alignment);

      // Update overlay position immediately
      this.positionOverlay(this.selectedImage);
    }
  }

  private setupResizeHandles(overlay: HTMLDivElement): void {
    const handles = overlay.querySelectorAll('.resize-handle');
    handles.forEach(handle => {
      handle.addEventListener('mousedown', (e) => this.startResize(e as MouseEvent, handle as HTMLElement));
    });
  }

  private startResize(e: MouseEvent, handle: HTMLElement): void {
    if (!this.selectedImage) return;

    e.preventDefault();
    e.stopPropagation();

    const img = this.selectedImage;
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = img.width || img.offsetWidth;
    const startHeight = img.height || img.offsetHeight;
    const aspectRatio = startWidth / startHeight;
    const handleClass = handle.className;

    this.onResizeMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      let newWidth = startWidth;
      let newHeight = startHeight;

      // Calculate new dimensions based on which handle is being dragged
      if (handleClass.includes('br') || handleClass.includes('tr')) {
        newWidth = Math.max(50, startWidth + deltaX);
      } else if (handleClass.includes('bl') || handleClass.includes('tl')) {
        newWidth = Math.max(50, startWidth - deltaX);
      }

      // Maintain aspect ratio
      newHeight = newWidth / aspectRatio;

      // Apply new dimensions
      img.setAttribute('width', Math.round(newWidth).toString());
      img.setAttribute('height', Math.round(newHeight).toString());

      // Update overlay position
      this.positionOverlay(img);
    };

    this.onResizeMouseUp = () => {
      if (this.onResizeMouseMove) {
        document.removeEventListener('mousemove', this.onResizeMouseMove);
        this.onResizeMouseMove = null;
      }
      if (this.onResizeMouseUp) {
        document.removeEventListener('mouseup', this.onResizeMouseUp);
        this.onResizeMouseUp = null;
      }

      // Trigger content change
      this.onContentChanged({ html: this.quillEditor.root.innerHTML });
    };

    document.addEventListener('mousemove', this.onResizeMouseMove);
    document.addEventListener('mouseup', this.onResizeMouseUp);
  }

  undo(): void {
    if (this.quillEditor) {
      this.quillEditor.history.undo();
    }
  }

  redo(): void {
    if (this.quillEditor) {
      this.quillEditor.history.redo();
    }
  }

  applyColor(type: 'color' | 'background', event: any): void {
    if (this.quillEditor) {
      const color = event.target.value;
      this.quillEditor.format(type, color);
    }
  }

  toggleInsertMenu(event: Event): void {
    event.stopPropagation();
    this.showInsertMenu = !this.showInsertMenu;
  }

  insertElement(type: string): void {
    if (!this.quillEditor) return;

    const html = this.elementTemplates[type];
    if (html) {
      const range = this.quillEditor.getSelection(true);
      if (range) {
        this.quillEditor.clipboard.dangerouslyPasteHTML(range.index, html);
        // Move cursor after inserted content
        // This is a bit tricky as we don't know exact length of inserted content in Quill delta terms
        // But usually pasting moves cursor to end
      } else {
        // Append to end if no selection
        const length = this.quillEditor.getLength();
        this.quillEditor.clipboard.dangerouslyPasteHTML(length, html);
      }
    }

    this.showInsertMenu = false;
  }

  toggleSourceMode(): void {
    if (!this.isSourceMode && this.quillEditor) {
      // Sync from Quill to model before switching to source mode
      // This ensures any pending changes in Quill are captured
      const rawHtml = this.quillEditor.root.innerHTML;
      this.value = this.formatHtml(rawHtml);
    }
    this.isSourceMode = !this.isSourceMode;
  }

  onSourceChange(): void {
    // When typing in source mode, value is already updated via ngModel
    this.contentChange.emit(this.value);
  }

  /**
   * Format HTML for readable display in source mode.
   * Uses js-beautify for professional, consistent formatting.
   *
   * @param html - Raw HTML from Quill editor
   * @returns Formatted HTML with proper indentation and line breaks
   */
  private formatHtml(html: string): string {
    // Handle edge cases first
    if (!html || html.trim() === '') {
      return '';
    }

    try {
      // Step 1: Normalize &nbsp; entities for readability
      // Trade-off: Loses non-breaking space semantics, but makes source
      // code much more readable. Visual mode is canonical representation.
      const normalized = html.replace(/&nbsp;/g, ' ');

      // Step 2: Apply js-beautify formatting
      const formatted = beautifyHtml(normalized, this.htmlBeautifyOptions);

      // Step 3: Post-process - remove excessive blank lines
      const cleaned = formatted.replace(/\n{3,}/g, '\n\n');

      return cleaned;
    } catch (error) {
      // Graceful degradation: if beautification fails, return original
      console.error('HTML beautification failed:', error);
      return html;
    }
  }
}
