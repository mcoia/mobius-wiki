import { Component, EventEmitter, Input, OnInit, OnChanges, SimpleChanges, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { debounceTime, map } from 'rxjs/operators';

@Component({
  selector: 'app-create-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './create-modal.component.html',
  styleUrls: ['./create-modal.component.css']
})
export class CreateModalComponent implements OnInit, OnChanges {
  @Input() modalTitle: string = 'Create';
  @Input() showSlug: boolean = true;
  @Input() showDescription: boolean = false;
  @Input() editMode: boolean = false;
  @Input() initialData: { title: string; slug: string; description: string } | null = null;
  @Output() create = new EventEmitter<any>();
  @Output() cancel = new EventEmitter<void>();

  form!: FormGroup;
  isLoading = false;
  errorMessage = '';
  private slugManuallyEdited = false;

  constructor(private fb: FormBuilder) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      title: ['', [Validators.required, Validators.maxLength(255)]],
      slug: [''],
      description: ['']
    });

    // Pre-populate form in edit mode
    if (this.editMode && this.initialData) {
      this.form.patchValue(this.initialData);
      this.slugManuallyEdited = true; // Don't auto-generate slug in edit mode
    }

    // Auto-generate slug from title (only in create mode or if slug not manually edited)
    this.form.get('title')?.valueChanges.pipe(
      debounceTime(300),
      map(title => this.slugify(title))
    ).subscribe(slug => {
      if (!this.slugManuallyEdited && !this.form.get('slug')?.dirty) {
        this.form.patchValue({ slug }, { emitEvent: false });
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Handle initialData changes (e.g., when modal is reused for different items)
    if (changes['initialData'] && this.form && this.editMode) {
      if (this.initialData) {
        this.form.patchValue(this.initialData);
        this.slugManuallyEdited = true;
      }
    }
  }

  slugify(text: string): string {
    if (!text) return '';
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  onSubmit(): void {
    if (this.form.valid) {
      this.create.emit(this.form.value);
    }
  }

  onCancel(): void {
    this.cancel.emit();
  }

  setLoading(loading: boolean): void {
    this.isLoading = loading;
  }

  setError(message: string): void {
    this.errorMessage = message;
  }
}
