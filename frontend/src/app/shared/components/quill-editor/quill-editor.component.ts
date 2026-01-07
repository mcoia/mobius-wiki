import { Component, Input, Output, EventEmitter, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { QuillModule } from 'ngx-quill';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import Quill from 'quill';

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
  styleUrl: './quill-editor.component.css',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => QuillEditorComponent),
      multi: true
    }
  ]
})
export class QuillEditorComponent implements ControlValueAccessor {
  @Input() set content(value: string) {
    if (value !== this.value) {
      this.value = value || '';
    }
  }
  @Input() placeholder: string = 'Start writing...';
  @Output() contentChange = new EventEmitter<string>();

  value: string = '';
  disabled: boolean = false;

  // Reference to Quill instance
  private quillEditor: any;

  // Image manipulation state
  private selectedImage: HTMLImageElement | null = null;
  private resizeOverlay: HTMLDivElement | null = null;

  // Quill configuration - use custom toolbar element
  quillConfig = {
    toolbar: '#quill-toolbar'
  };

  // ControlValueAccessor implementation
  onChange: any = () => {};
  onTouched: any = () => {};

  writeValue(value: any): void {
    this.value = value || '';
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  onContentChanged(event: any): void {
    const html = event.html;
    this.value = html;
    this.onChange(html);
    this.onTouched();
    this.contentChange.emit(html);
  }

  onEditorCreated(quill: any): void {
    this.quillEditor = quill;
    this.setupImageHandling();
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
    document.addEventListener('click', (e: Event) => {
      if (!editor.contains(e.target as Node)) {
        this.deselectImage();
      }
    });

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
    window.addEventListener('resize', () => {
      if (this.selectedImage) {
        this.positionOverlay(this.selectedImage);
      }
    });

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

    const onMouseMove = (e: MouseEvent) => {
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

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      // Trigger content change
      this.onContentChanged({ html: this.quillEditor.root.innerHTML });
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
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

  toggleInsertMenu(): void {
    // Placeholder for insert menu - implement in parent component
  }

  toggleSourceMode(): void {
    // Placeholder for source mode - implement in parent component
  }
}
