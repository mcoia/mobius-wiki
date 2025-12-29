import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { User } from '../../core/models/user.model';

@Component({
  selector: 'app-home',
  imports: [CommonModule],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class HomeComponent implements OnInit {
  currentUser: User | null = null;
  wikis = 0;
  pages = 0;
  views = 0;
  users = 0;

  constructor(
    private authService: AuthService,
    private apiService: ApiService
  ) {}

  ngOnInit(): void {
    // Subscribe to current user
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });

    // Load platform statistics
    this.loadStatistics();
  }

  loadStatistics(): void {
    this.apiService.get<any>('/analytics/stats').subscribe({
      next: (response) => {
        // Extract stats from backend response
        if (response.content) {
          this.wikis = response.content.wikis || 0;
          this.pages = response.content.pages || 0;
        }
        if (response.views) {
          this.views = response.views.total || 0;
          this.users = response.views.uniqueUsers || 0;
        }
      },
      error: (error) => {
        console.error('Failed to load statistics:', error);
        // Set default values on error
        this.wikis = 0;
        this.pages = 0;
        this.views = 0;
        this.users = 0;
      }
    });
  }
}
