import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
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
export class CreateModalComponent implements OnInit {
  @Input() modalTitle: string = 'Create';
  @Input() showSlug: boolean = true;
  @Input() showDescription: boolean = false;
  @Output() create = new EventEmitter<any>();
  @Output() cancel = new EventEmitter<void>();

  form!: FormGroup;
  isLoading = false;
  errorMessage = '';

  constructor(private fb: FormBuilder) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      title: ['', [Validators.required, Validators.maxLength(255)]],
      slug: [''],
      description: ['']
    });

    // Auto-generate slug from title
    this.form.get('title')?.valueChanges.pipe(
      debounceTime(300),
      map(title => this.slugify(title))
    ).subscribe(slug => {
      if (!this.form.get('slug')?.dirty) {
        this.form.patchValue({ slug }, { emitEvent: false });
      }
    });
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
