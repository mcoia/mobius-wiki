import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-reset-password',
  imports: [FormsModule, RouterLink],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.css'
})
export class ResetPasswordComponent implements OnInit {
  token = '';
  password = '';
  confirmPassword = '';
  isLoading = false;
  errorMessage = '';
  successMessage = '';
  completed = false;

  // Password validation state
  passwordErrors: string[] = [];

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    // Get token from URL query params
    this.route.queryParams.subscribe(params => {
      this.token = params['token'] || '';
      if (!this.token) {
        this.errorMessage = 'Invalid or missing reset token. Please request a new password reset.';
      }
    });
  }

  validatePassword(): boolean {
    this.passwordErrors = [];

    if (this.password.length < 12) {
      this.passwordErrors.push('Password must be at least 12 characters');
    }
    if (this.password.length > 128) {
      this.passwordErrors.push('Password must be less than 128 characters');
    }
    if (!/[a-z]/.test(this.password)) {
      this.passwordErrors.push('Must contain at least one lowercase letter');
    }
    if (!/[A-Z]/.test(this.password)) {
      this.passwordErrors.push('Must contain at least one uppercase letter');
    }
    if (!/[0-9]/.test(this.password)) {
      this.passwordErrors.push('Must contain at least one number');
    }

    return this.passwordErrors.length === 0;
  }

  onSubmit(): void {
    this.errorMessage = '';

    if (!this.token) {
      this.errorMessage = 'Invalid or missing reset token. Please request a new password reset.';
      return;
    }

    if (!this.password || !this.confirmPassword) {
      this.errorMessage = 'Please fill in all fields';
      return;
    }

    if (!this.validatePassword()) {
      this.errorMessage = 'Please fix the password errors below';
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.errorMessage = 'Passwords do not match';
      return;
    }

    this.isLoading = true;

    this.authService.resetPassword(this.token, this.password).subscribe({
      next: (response) => {
        this.completed = true;
        this.successMessage = response.message || 'Your password has been reset successfully.';
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Reset password error:', error);
        this.errorMessage = error.error?.message || 'Failed to reset password. The link may have expired.';
        this.isLoading = false;
      }
    });
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }
}
