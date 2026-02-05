import { Component, OnInit, HostListener, ElementRef } from '@angular/core';
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
  isDropdownOpen = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private toastService: ToastService,
    private elementRef: ElementRef
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

  /**
   * Toggle avatar dropdown menu
   */
  toggleDropdown(): void {
    this.isDropdownOpen = !this.isDropdownOpen;
  }

  /**
   * Close dropdown when clicking outside
   */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const clickedInside = this.elementRef.nativeElement
      .querySelector('.avatar-dropdown-container')
      ?.contains(event.target as Node);

    if (!clickedInside) {
      this.isDropdownOpen = false;
    }
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

  /**
   * Navigate to a route and close dropdown
   */
  navigateTo(route: string): void {
    this.isDropdownOpen = false;
    this.router.navigate([route]);
  }

  logout(): void {
    this.isDropdownOpen = false;
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
