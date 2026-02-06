import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable, of } from 'rxjs';
import { map, catchError, shareReplay } from 'rxjs/operators';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { User } from '../../core/models/user.model';
import { SeoService } from '../../core/services/seo.service';

interface PlatformStats {
  wikis: number;
  pages: number;
  views: number;
  users: number;
}

@Component({
  selector: 'app-home',
  imports: [CommonModule],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class HomeComponent implements OnInit, OnDestroy {
  currentUser$!: Observable<User | null>;
  stats$!: Observable<PlatformStats>;

  constructor(
    private authService: AuthService,
    private apiService: ApiService,
    private seoService: SeoService
  ) {}

  ngOnInit(): void {
    // Set SEO meta tags for homepage
    this.seoService.updateMetaTags({
      title: undefined, // Use default title
      description: 'MOBIUS Wiki - Collaborative documentation for MOBIUS Library Consortium. Access library resources, documentation, and guides.',
      ogType: 'website'
    });

    // Use the existing BehaviorSubject as an observable
    this.currentUser$ = this.authService.currentUser$;

    // Load platform statistics as observable
    this.stats$ = this.apiService.get<any>('/analytics/stats').pipe(
      map(response => ({
        wikis: response.content?.wikis || 0,
        pages: response.content?.pages || 0,
        views: response.views?.total || 0,
        users: response.views?.uniqueUsers || 0
      })),
      catchError(error => {
        console.error('Failed to load statistics:', error);
        return of({ wikis: 0, pages: 0, views: 0, users: 0 });
      }),
      shareReplay(1) // Cache the result
    );
  }

  ngOnDestroy(): void {
    this.seoService.resetToDefaults();
  }
}
