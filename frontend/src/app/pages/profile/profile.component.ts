import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
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
  @ViewChild('avatarInput') avatarInput!: ElementRef<HTMLInputElement>;

  currentUser$!: Observable<User | null>;

  // Avatar upload
  isAvatarLoading = false;
  avatarError = '';

  // Preset avatars
  readonly presetAvatars = [1, 2, 3, 4, 5, 6, 7, 8];
  selectedPreset: string | null = null;
  isPresetLoading = false;

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

  // Allowed file types for avatar
  private readonly ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  private readonly MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5MB

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
        this.selectedPreset = user.avatarPreset;
      }
    });
  }

  /**
   * Get user initials for avatar fallback
   */
  getInitials(name: string): string {
    if (!name) return '?';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
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

  /**
   * Trigger file input click
   */
  triggerAvatarUpload(): void {
    this.avatarInput.nativeElement.click();
  }

  /**
   * Handle file selection for avatar upload
   */
  onAvatarFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }

    const file = input.files[0];
    this.avatarError = '';

    // Validate file type
    if (!this.ALLOWED_AVATAR_TYPES.includes(file.type)) {
      this.avatarError = 'Please select a valid image file (JPG, PNG, GIF, or WebP)';
      this.toastService.error(this.avatarError);
      input.value = ''; // Clear the input
      return;
    }

    // Validate file size
    if (file.size > this.MAX_AVATAR_SIZE) {
      this.avatarError = 'File size must be less than 5MB';
      this.toastService.error(this.avatarError);
      input.value = ''; // Clear the input
      return;
    }

    this.uploadAvatar(file);
    input.value = ''; // Clear the input for next selection
  }

  /**
   * Upload avatar file
   */
  private uploadAvatar(file: File): void {
    this.isAvatarLoading = true;
    this.avatarError = '';

    this.authService.uploadAvatar(file).subscribe({
      next: () => {
        this.toastService.success('Profile photo updated');
        this.isAvatarLoading = false;
      },
      error: (err) => {
        this.avatarError = err.error?.message || 'Failed to upload photo';
        this.toastService.error(this.avatarError);
        this.isAvatarLoading = false;
      }
    });
  }

  /**
   * Remove current avatar
   */
  removeAvatar(): void {
    this.isAvatarLoading = true;
    this.avatarError = '';

    this.authService.removeAvatar().subscribe({
      next: () => {
        this.toastService.success('Profile photo removed');
        this.isAvatarLoading = false;
      },
      error: (err) => {
        this.avatarError = err.error?.message || 'Failed to remove photo';
        this.toastService.error(this.avatarError);
        this.isAvatarLoading = false;
      }
    });
  }

  /**
   * Select a preset avatar
   */
  selectPreset(presetNumber: number): void {
    const preset = `avatar-${presetNumber}`;

    // If clicking on already selected preset, deselect it
    const newPreset = this.selectedPreset === preset ? null : preset;

    this.isPresetLoading = true;
    this.avatarError = '';

    this.authService.setAvatarPreset(newPreset).subscribe({
      next: () => {
        this.selectedPreset = newPreset;
        this.toastService.success(newPreset ? 'Avatar updated' : 'Avatar cleared');
        this.isPresetLoading = false;
      },
      error: (err) => {
        this.avatarError = err.error?.message || 'Failed to update avatar';
        this.toastService.error(this.avatarError);
        this.isPresetLoading = false;
      }
    });
  }

  /**
   * Check if a preset is currently selected
   */
  isPresetSelected(presetNumber: number): boolean {
    return this.selectedPreset === `avatar-${presetNumber}`;
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
