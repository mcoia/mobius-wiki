import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { switchMap, catchError, shareReplay, map } from 'rxjs/operators';
import { StaffService } from '../../../core/services/staff.service';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { Library } from '../../../core/models/staff.model';

@Component({
  selector: 'app-libraries',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './libraries.component.html',
  styleUrl: './libraries.component.css',
})
export class LibrariesComponent implements OnInit {
  libraries$!: Observable<Library[]>;
  private refreshTrigger$ = new BehaviorSubject<void>(undefined);

  // Modal state
  showCreateModal = false;
  showEditModal = false;

  // Form data
  createForm = { name: '' };
  editForm = { id: 0, name: '' };

  // Loading states
  isSubmitting = false;

  constructor(
    private staffService: StaffService,
    private toastService: ToastService,
    private confirmDialogService: ConfirmDialogService
  ) {}

  ngOnInit(): void {
    this.libraries$ = this.refreshTrigger$.pipe(
      switchMap(() => this.staffService.getLibraries()),
      map(response => response.data),
      catchError(error => {
        console.error('Failed to load libraries:', error);
        this.toastService.error('Failed to load libraries');
        return of([]);
      }),
      shareReplay(1)
    );
  }

  refreshLibraries(): void {
    this.refreshTrigger$.next();
  }

  // Auto-generate slug from name
  generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  // Create library
  openCreateModal(): void {
    this.createForm = { name: '' };
    this.showCreateModal = true;
  }

  closeCreateModal(): void {
    this.showCreateModal = false;
  }

  submitCreate(): void {
    if (!this.createForm.name) {
      this.toastService.error('Name is required');
      return;
    }

    const slug = this.generateSlug(this.createForm.name);

    this.isSubmitting = true;
    this.staffService.createLibrary({ name: this.createForm.name, slug }).subscribe({
      next: () => {
        this.toastService.success('Library created successfully');
        this.closeCreateModal();
        this.refreshLibraries();
        this.isSubmitting = false;
      },
      error: (error) => {
        console.error('Failed to create library:', error);
        this.toastService.error(error.error?.message || 'Failed to create library');
        this.isSubmitting = false;
      }
    });
  }

  // Edit library
  openEditModal(library: Library): void {
    this.editForm = { id: library.id, name: library.name };
    this.showEditModal = true;
  }

  closeEditModal(): void {
    this.showEditModal = false;
  }

  submitEdit(): void {
    if (!this.editForm.name) {
      this.toastService.error('Name is required');
      return;
    }

    const slug = this.generateSlug(this.editForm.name);

    this.isSubmitting = true;
    this.staffService.updateLibrary(this.editForm.id, {
      name: this.editForm.name,
      slug
    }).subscribe({
      next: () => {
        this.toastService.success('Library updated successfully');
        this.closeEditModal();
        this.refreshLibraries();
        this.isSubmitting = false;
      },
      error: (error) => {
        console.error('Failed to update library:', error);
        this.toastService.error(error.error?.message || 'Failed to update library');
        this.isSubmitting = false;
      }
    });
  }

  // Delete library
  deleteLibrary(library: Library): void {
    this.confirmDialogService.open({
      title: 'Delete Library',
      message: `Are you sure you want to delete "${library.name}"? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      type: 'danger'
    }).subscribe(confirmed => {
      if (!confirmed) return;

      this.staffService.deleteLibrary(library.id).subscribe({
        next: () => {
          this.toastService.success('Library deleted successfully');
          this.refreshLibraries();
        },
        error: (error) => {
          console.error('Failed to delete library:', error);
          this.toastService.error(error.error?.message || 'Failed to delete library');
        }
      });
    });
  }
}
