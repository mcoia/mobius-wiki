import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, catchError, shareReplay } from 'rxjs/operators';
import { WikiService } from '../../core/services/wiki.service';
import { AuthService } from '../../core/services/auth.service';
import { Wiki } from '../../core/models/wiki.model';

@Component({
  selector: 'app-wiki-list',
  imports: [CommonModule, RouterModule],
  templateUrl: './wiki-list.html',
  styleUrl: './wiki-list.css'
})
export class WikiListComponent implements OnInit {
  wikis$!: Observable<Wiki[]>;
  canCreate$!: Observable<boolean>;
  error: string | null = null;

  constructor(
    private wikiService: WikiService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.wikis$ = this.wikiService.getWikis().pipe(
      map(response => response.data),
      catchError(error => {
        console.error('Failed to load wikis:', error);
        this.error = 'Failed to load wikis. Please try again later.';
        return of([]);
      }),
      shareReplay(1) // Cache the result to avoid multiple HTTP calls
    );

    // Check if user can create wikis (site_admin or mobius_staff)
    this.canCreate$ = this.authService.currentUser$.pipe(
      map(user => {
        if (!user) return false;
        return user.role === 'site_admin' || user.role === 'mobius_staff';
      }),
      shareReplay(1)
    );
  }
}
