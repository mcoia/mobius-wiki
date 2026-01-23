import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { User } from '../../core/models/user.model';

@Component({
  selector: 'app-profile',
  imports: [CommonModule, FormsModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css'
})
export class ProfileComponent implements OnInit {
  currentUser$!: Observable<User | null>;

  // Profile form
  profileName = '';
  profileEmail = '';
  isProfileLoading = false;
  profileError = '';

  // Password form
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';
  isPasswordLoading = false;
  passwordError = '';
  showPasswordForm = false;

  constructor(
    private authService: AuthService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.currentUser$ = this.authService.currentUser$;

    // Initialize form with current values
    this.currentUser$.subscribe(user => {
      if (user) {
        this.profileName = user.name;
        this.profileEmail = user.email;
      }
    });
  }

  getRoleDisplayName(role: string): string {
    const roleNames: Record<string, string> = {
      'guest': 'Guest',
      'library_staff': 'Library Staff',
      'mobius_staff': 'MOBIUS Staff',
      'site_admin': 'Site Administrator'
    };
    return roleNames[role] || role;
  }

  onProfileSubmit(): void {
    const currentUser = this.authService.currentUserValue;
    if (!currentUser) return;

    // Check if anything changed
    const nameChanged = this.profileName !== currentUser.name;
    const emailChanged = this.profileEmail !== currentUser.email;

    if (!nameChanged && !emailChanged) {
      this.toastService.info('No changes to save');
      return;
    }

    // Validate
    if (!this.profileName.trim()) {
      this.profileError = 'Name is required';
      return;
    }

    if (!this.profileEmail.trim()) {
      this.profileError = 'Email is required';
      return;
    }

    this.isProfileLoading = true;
    this.profileError = '';

    this.authService.updateProfile(
      nameChanged ? this.profileName : undefined,
      emailChanged ? this.profileEmail : undefined
    ).subscribe({
      next: () => {
        this.toastService.success('Profile updated successfully');
        this.isProfileLoading = false;
      },
      error: (err) => {
        this.profileError = err.error?.message || 'Failed to update profile';
        this.isProfileLoading = false;
      }
    });
  }

  togglePasswordForm(): void {
    this.showPasswordForm = !this.showPasswordForm;
    if (!this.showPasswordForm) {
      this.resetPasswordForm();
    }
  }

  resetPasswordForm(): void {
    this.currentPassword = '';
    this.newPassword = '';
    this.confirmPassword = '';
    this.passwordError = '';
  }

  onPasswordSubmit(): void {
    // Validate
    if (!this.currentPassword) {
      this.passwordError = 'Current password is required';
      return;
    }

    if (!this.newPassword) {
      this.passwordError = 'New password is required';
      return;
    }

    if (this.newPassword.length < 12) {
      this.passwordError = 'New password must be at least 12 characters';
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.passwordError = 'Passwords do not match';
      return;
    }

    this.isPasswordLoading = true;
    this.passwordError = '';

    this.authService.changePassword(this.currentPassword, this.newPassword).subscribe({
      next: () => {
        this.toastService.success('Password changed successfully');
        this.resetPasswordForm();
        this.showPasswordForm = false;
        this.isPasswordLoading = false;
      },
      error: (err) => {
        this.passwordError = err.error?.message || 'Failed to change password';
        this.isPasswordLoading = false;
      }
    });
  }
}
