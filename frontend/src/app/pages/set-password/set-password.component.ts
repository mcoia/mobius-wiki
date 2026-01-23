import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-set-password',
  imports: [FormsModule, RouterLink],
  templateUrl: './set-password.component.html',
  styleUrl: './set-password.component.css'
})
export class SetPasswordComponent implements OnInit {
  token = '';
  password = '';
  confirmPassword = '';
  isLoading = false;
  isValidating = true;
  errorMessage = '';
  successMessage = '';
  completed = false;

  // User info from token validation
  userName = '';
  userEmail = '';

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
        this.isValidating = false;
        this.errorMessage = 'Invalid or missing invitation token. Please contact your administrator.';
      } else {
        // Validate the token
        this.validateToken();
      }
    });
  }

  validateToken(): void {
    this.authService.validateInvitationToken(this.token).subscribe({
      next: (response) => {
        this.isValidating = false;
        if (response.valid) {
          this.userName = response.name || '';
          this.userEmail = response.email || '';
        } else {
          this.errorMessage = 'This invitation link is invalid or has expired. Please contact your administrator for a new invitation.';
        }
      },
      error: (error) => {
        this.isValidating = false;
        console.error('Token validation error:', error);
        this.errorMessage = 'Failed to validate invitation. Please try again or contact your administrator.';
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
      this.errorMessage = 'Invalid or missing invitation token. Please contact your administrator.';
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

    this.authService.acceptInvitation(this.token, this.password).subscribe({
      next: (response) => {
        this.completed = true;
        this.successMessage = response.message || 'Your password has been set successfully.';
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Accept invitation error:', error);
        this.errorMessage = error.error?.message || 'Failed to set password. The invitation may have expired.';
        this.isLoading = false;
      }
    });
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }
}
