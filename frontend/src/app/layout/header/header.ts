import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { User } from '../../core/models/user.model';

@Component({
  selector: 'app-header',
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header implements OnInit {
  currentUser$!: Observable<User | null>;
  searchQuery = '';

  constructor(
    private authService: AuthService,
    private router: Router,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.currentUser$ = this.authService.currentUser$;
  }

  /**
   * Handle search submission from header
   */
  onSearchSubmit(): void {
    const query = this.searchQuery.trim();
    if (query) {
      this.router.navigate(['/search'], { queryParams: { q: query } });
      this.searchQuery = '';
    }
  }

  /**
   * Handle keydown on search input
   */
  onSearchKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      this.onSearchSubmit();
    }
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => {
        this.toastService.success('You have been logged out');
        this.router.navigate(['/']);
      },
      error: (err) => {
        console.error('Logout error:', err);
        this.toastService.info('You have been logged out');
        this.router.navigate(['/']);
      }
    });
  }
}
