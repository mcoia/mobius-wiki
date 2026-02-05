import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { Subject, BehaviorSubject } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { SearchService, SearchResult } from '../../core/services/search.service';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './search.component.html',
  styleUrl: './search.component.css',
})
export class SearchComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private searchTermSubject = new BehaviorSubject<string>('');

  searchQuery = '';
  results: SearchResult[] = [];
  isLoading = false;
  error: string | null = null;
  totalResults = 0;
  hasMore = false;
  currentOffset = 0;
  readonly pageSize = 20;

  constructor(
    private searchService: SearchService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Get initial query from URL
    this.route.queryParams.pipe(
      takeUntil(this.destroy$)
    ).subscribe(params => {
      const query = params['q'] || '';
      if (query !== this.searchQuery) {
        this.searchQuery = query;
        this.resetAndSearch();
      }
    });

    // Set up debounced search from input
    this.searchTermSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(term => {
      if (term && term !== this.route.snapshot.queryParams['q']) {
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { q: term },
          queryParamsHandling: 'merge'
        });
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Reset results and perform search
   */
  private resetAndSearch(): void {
    this.results = [];
    this.currentOffset = 0;
    this.hasMore = false;
    this.error = null;

    if (this.searchQuery.trim()) {
      this.performSearch();
    }
  }

  /**
   * Perform the search
   */
  private performSearch(): void {
    this.isLoading = true;
    this.error = null;

    this.searchService.search({
      q: this.searchQuery,
      limit: this.pageSize,
      offset: this.currentOffset
    }).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (response) => {
        if (this.currentOffset === 0) {
          this.results = response.data;
        } else {
          this.results = [...this.results, ...response.data];
        }
        this.totalResults = response.meta.total;
        this.hasMore = response.meta.hasMore;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Search error:', err);
        this.error = 'Failed to search. Please try again.';
        this.isLoading = false;
      }
    });
  }

  /**
   * Handle search form submission
   */
  onSearchSubmit(): void {
    if (this.searchQuery.trim()) {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { q: this.searchQuery.trim() },
        queryParamsHandling: 'merge'
      });
    }
  }

  /**
   * Handle search input keydown
   */
  onSearchKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      this.onSearchSubmit();
    }
  }

  /**
   * Handle input changes (for debounced search)
   */
  onSearchInput(): void {
    this.searchTermSubject.next(this.searchQuery);
  }

  /**
   * Load more results
   */
  loadMore(): void {
    if (!this.isLoading && this.hasMore) {
      this.currentOffset += this.pageSize;
      this.performSearch();
    }
  }

  /**
   * Get the page URL for a search result
   */
  getPageUrl(result: SearchResult): string[] {
    return ['/wiki', result.wiki.slug, result.section.slug, result.slug];
  }

  /**
   * Format date for display
   */
  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
}
