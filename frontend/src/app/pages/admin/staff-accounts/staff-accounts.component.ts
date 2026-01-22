import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { switchMap, catchError, shareReplay, map } from 'rxjs/operators';
import { AdminService } from '../../../core/services/admin.service';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { StaffUser } from '../../../core/models/admin.model';

@Component({
  selector: 'app-staff-accounts',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './staff-accounts.component.html',
  styleUrl: './staff-accounts.component.css',
})
export class StaffAccountsComponent implements OnInit {
  users$!: Observable<StaffUser[]>;
  private refreshTrigger$ = new BehaviorSubject<void>(undefined);

  // Modal state
  showCreateModal = false;
  showEditModal = false;
  showResetPasswordModal = false;

  // Form data
  createForm = { email: '', name: '', password: '' };
  editForm = { id: 0, email: '', name: '' };
  resetPasswordForm = { id: 0, name: '', password: '' };

  // Loading states
  isSubmitting = false;

  constructor(
    private adminService: AdminService,
    private toastService: ToastService,
    private confirmDialogService: ConfirmDialogService
  ) {}

  ngOnInit(): void {
    this.users$ = this.refreshTrigger$.pipe(
      switchMap(() => this.adminService.getStaffUsers()),
      map(response => response.data),
      catchError(error => {
        console.error('Failed to load staff users:', error);
        this.toastService.error('Failed to load staff users');
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
    this.createForm = { email: '', name: '', password: '' };
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

    this.isSubmitting = true;
    this.adminService.createStaffUser(this.createForm).subscribe({
      next: () => {
        this.toastService.success('Staff user created successfully');
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
  openEditModal(user: StaffUser): void {
    this.editForm = { id: user.id, email: user.email, name: user.name };
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

    this.isSubmitting = true;
    this.adminService.updateStaffUser(this.editForm.id, {
      email: this.editForm.email,
      name: this.editForm.name
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
  toggleActive(user: StaffUser): void {
    const action = user.isActive ? 'deactivate' : 'activate';
    const observable = user.isActive
      ? this.adminService.deactivateStaffUser(user.id)
      : this.adminService.activateStaffUser(user.id);

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
  deleteUser(user: StaffUser): void {
    this.confirmDialogService.open({
      title: 'Delete User',
      message: `Are you sure you want to delete "${user.name}"? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      type: 'danger'
    }).subscribe(confirmed => {
      if (!confirmed) return;

      this.adminService.deleteStaffUser(user.id).subscribe({
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
  openResetPasswordModal(user: StaffUser): void {
    this.resetPasswordForm = { id: user.id, name: user.name, password: '' };
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
    this.adminService.resetPassword(this.resetPasswordForm.id, this.resetPasswordForm.password).subscribe({
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
}
