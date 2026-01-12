import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { debounceTime, map } from 'rxjs/operators';
import { WikiService } from '../../core/services/wiki.service';

@Component({
  selector: 'app-wiki-create',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './wiki-create.component.html',
  styleUrls: ['./wiki-create.component.css']
})
export class WikiCreateComponent implements OnInit {
  form!: FormGroup;
  isLoading = false;
  errorMessage = '';

  constructor(
    private fb: FormBuilder,
    private wikiService: WikiService,
    private router: Router
  ) {}

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
      this.isLoading = true;
      this.errorMessage = '';

      this.wikiService.createWiki(this.form.value).subscribe({
        next: (response) => {
          this.router.navigate(['/wiki', response.data.slug]);
        },
        error: (error) => {
          this.errorMessage = error.error?.message || 'Failed to create wiki';
          this.isLoading = false;
        }
      });
    }
  }

  onCancel(): void {
    this.router.navigate(['/wikis']);
  }
}
