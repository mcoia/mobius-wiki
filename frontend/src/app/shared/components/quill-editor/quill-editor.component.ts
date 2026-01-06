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
