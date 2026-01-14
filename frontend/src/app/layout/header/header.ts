import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Observable } from 'rxjs';
import { PageContextService, PageEditState } from '../../core/services/page-context.service';
import { AuthService } from '../../core/services/auth.service';
import { User } from '../../core/models/user.model';

@Component({
  selector: 'app-header',
  imports: [CommonModule, RouterModule],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header implements OnInit {
  editState$!: Observable<PageEditState>;
  currentUser$!: Observable<User | null>;

  constructor(
    private pageContext: PageContextService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.editState$ = this.pageContext.editState$;
    this.currentUser$ = this.authService.currentUser$;
  }

  toggleEdit(): void {
    const currentState = this.pageContext.currentState;
    this.pageContext.updateEditState({
      isEditing: !currentState.isEditing
    });
  }

  saveContent(): void {
    // Trigger save event - WikiPageViewer will handle actual save
    this.pageContext.updateEditState({
      isSaving: true
    });
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => {
        this.router.navigate(['/login']);
      },
      error: (err) => {
        console.error('Logout error:', err);
        // Navigate to login anyway
        this.router.navigate(['/login']);
      }
    });
  }
}
