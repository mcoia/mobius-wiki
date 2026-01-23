import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { switchMap, catchError, shareReplay, map } from 'rxjs/operators';
import { StaffService } from '../../../core/services/staff.service';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { LibraryStaffUser, Library } from '../../../core/models/staff.model';

@Component({
  selector: 'app-library-staff',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './library-staff.component.html',
  styleUrl: './library-staff.component.css',
})
export class LibraryStaffComponent implements OnInit {
  users$!: Observable<LibraryStaffUser[]>;
  libraries$!: Observable<Library[]>;
  private refreshTrigger$ = new BehaviorSubject<void>(undefined);

  // Modal state
  showCreateModal = false;
  showEditModal = false;
  showResetPasswordModal = false;

  // Form data
  createForm = { email: '', name: '', password: '', libraryId: 0 };
  editForm = { id: 0, email: '', name: '', libraryId: 0 };
  resetPasswordForm = { id: 0, name: '', email: '', password: '' };

  // Loading states
  isSubmitting = false;
  isSendingResetEmail = false;

  constructor(
    private staffService: StaffService,
    private toastService: ToastService,
    private confirmDialogService: ConfirmDialogService
  ) {}

  ngOnInit(): void {
    this.users$ = this.refreshTrigger$.pipe(
      switchMap(() => this.staffService.getLibraryStaffUsers()),
      map(response => response.data),
      catchError(error => {
        console.error('Failed to load library staff users:', error);
        this.toastService.error('Failed to load library staff users');
        return of([]);
      }),
      shareReplay(1)
    );

    this.libraries$ = this.staffService.getLibraries().pipe(
      map(response => response.data),
      catchError(error => {
        console.error('Failed to load libraries:', error);
        this.toastService.error('Failed to load libraries');
        return of([]);
      }),
      shareReplay(1)
    );
  }

  refreshUsers(): void {
    this.refreshTrigger$.next();
  }

  // Create user
  openCreateModal(): void {
    this.createForm = { email: '', name: '', password: '', libraryId: 0 };
    this.showCreateModal = true;
  }

  closeCreateModal(): void {
    this.showCreateModal = false;
  }

  submitCreate(): void {
    if (!this.createForm.email || !this.createForm.name || !this.createForm.password) {
      this.toastService.error('All fields are required');
      return;
    }

    if (!this.createForm.libraryId) {
      this.toastService.error('Library is required');
      return;
    }

    this.isSubmitting = true;
    this.staffService.createLibraryStaffUser(this.createForm).subscribe({
      next: () => {
        this.toastService.success('Library staff user created successfully');
        this.closeCreateModal();
        this.refreshUsers();
        this.isSubmitting = false;
      },
      error: (error) => {
        console.error('Failed to create user:', error);
        this.toastService.error(error.error?.message || 'Failed to create user');
        this.isSubmitting = false;
      }
    });
  }

  // Edit user
  openEditModal(user: LibraryStaffUser): void {
    this.editForm = { id: user.id, email: user.email, name: user.name, libraryId: user.libraryId };
    this.showEditModal = true;
  }

  closeEditModal(): void {
    this.showEditModal = false;
  }

  submitEdit(): void {
    if (!this.editForm.email || !this.editForm.name) {
      this.toastService.error('Email and name are required');
      return;
    }

    if (!this.editForm.libraryId) {
      this.toastService.error('Library is required');
      return;
    }

    this.isSubmitting = true;
    this.staffService.updateLibraryStaffUser(this.editForm.id, {
      email: this.editForm.email,
      name: this.editForm.name,
      libraryId: this.editForm.libraryId
    }).subscribe({
      next: () => {
        this.toastService.success('User updated successfully');
        this.closeEditModal();
        this.refreshUsers();
        this.isSubmitting = false;
      },
      error: (error) => {
        console.error('Failed to update user:', error);
        this.toastService.error(error.error?.message || 'Failed to update user');
        this.isSubmitting = false;
      }
    });
  }

  // Toggle active status
  toggleActive(user: LibraryStaffUser): void {
    const action = user.isActive ? 'deactivate' : 'activate';
    const observable = user.isActive
      ? this.staffService.deactivateLibraryStaffUser(user.id)
      : this.staffService.activateLibraryStaffUser(user.id);

    observable.subscribe({
      next: () => {
        this.toastService.success(`User ${action}d successfully`);
        this.refreshUsers();
      },
      error: (error) => {
        console.error(`Failed to ${action} user:`, error);
        this.toastService.error(`Failed to ${action} user`);
      }
    });
  }

  // Delete user
  deleteUser(user: LibraryStaffUser): void {
    this.confirmDialogService.open({
      title: 'Delete User',
      message: `Are you sure you want to delete "${user.name}"? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      type: 'danger'
    }).subscribe(confirmed => {
      if (!confirmed) return;

      this.staffService.deleteLibraryStaffUser(user.id).subscribe({
        next: () => {
          this.toastService.success('User deleted successfully');
          this.refreshUsers();
        },
        error: (error) => {
          console.error('Failed to delete user:', error);
          this.toastService.error('Failed to delete user');
        }
      });
    });
  }

  // Reset password
  openResetPasswordModal(user: LibraryStaffUser): void {
    this.resetPasswordForm = { id: user.id, name: user.name, email: user.email, password: '' };
    this.showResetPasswordModal = true;
  }

  closeResetPasswordModal(): void {
    this.showResetPasswordModal = false;
  }

  submitResetPassword(): void {
    if (!this.resetPasswordForm.password) {
      this.toastService.error('Password is required');
      return;
    }

    this.isSubmitting = true;
    this.staffService.resetLibraryStaffPassword(this.resetPasswordForm.id, this.resetPasswordForm.password).subscribe({
      next: () => {
        this.toastService.success('Password reset successfully');
        this.closeResetPasswordModal();
        this.isSubmitting = false;
      },
      error: (error) => {
        console.error('Failed to reset password:', error);
        this.toastService.error(error.error?.message || 'Failed to reset password');
        this.isSubmitting = false;
      }
    });
  }

  sendPasswordResetEmail(): void {
    this.isSendingResetEmail = true;
    this.staffService.sendPasswordResetEmail(this.resetPasswordForm.id).subscribe({
      next: () => {
        this.toastService.success('Password reset email has been sent');
        this.closeResetPasswordModal();
        this.isSendingResetEmail = false;
      },
      error: (error) => {
        console.error('Failed to send password reset email:', error);
        this.toastService.error(error.error?.message || 'Failed to send password reset email');
        this.isSendingResetEmail = false;
      }
    });
  }
}
