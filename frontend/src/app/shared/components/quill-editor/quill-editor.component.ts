import { Component, Input, Output, EventEmitter, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { QuillModule } from 'ngx-quill';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

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
  }

  private selectImage(img: HTMLImageElement): void {
    this.selectedImage = img;
    this.showImageControls(img);
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
    if (!this.selectedImage) return;

    // Remove existing alignment classes
    this.selectedImage.classList.remove('ql-align-left', 'ql-align-center', 'ql-align-right');

    // Add new alignment class
    if (alignment) {
      this.selectedImage.classList.add(`ql-align-${alignment}`);
    }

    // Trigger content change
    this.onContentChanged({ html: this.quillEditor.root.innerHTML });
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
