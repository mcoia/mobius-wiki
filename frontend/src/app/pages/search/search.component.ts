import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { BehaviorSubject, Observable, Subject, of, merge } from 'rxjs';
import { map, distinctUntilChanged, debounceTime, switchMap, tap, catchError, shareReplay, scan, filter } from 'rxjs/operators';
import { SearchService, SearchResult } from '../../core/services/search.service';

interface SearchState {
  results: SearchResult[];
  total: number;
  hasMore: boolean;
  error: string | null;
}

interface SearchTrigger {
  query: string;
  offset: number;
  append: boolean;
}

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './search.component.html',
  styleUrl: './search.component.css',
})
export class SearchComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private loadMore$ = new Subject<void>();

  // Observable streams for async pipe
  searchQuery$!: Observable<string>;
  isLoading$ = new BehaviorSubject<boolean>(false);
  searchState$!: Observable<SearchState>;

  // Track current offset for load more
  private currentOffset = 0;
  private currentQuery = '';

  // For template access
  readonly pageSize = 20;

  constructor(
    private searchService: SearchService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    // Extract and deduplicate query from URL params
    this.searchQuery$ = this.route.queryParams.pipe(
      map(params => params['q'] || ''),
      distinctUntilChanged(),
      debounceTime(50),
      shareReplay(1)
    );

    // Create triggers: new search (from query change) and load more
    const newSearch$: Observable<SearchTrigger> = this.searchQuery$.pipe(
      tap(query => {
        this.currentQuery = query;
        this.currentOffset = 0;
      }),
      map(query => ({ query, offset: 0, append: false }))
    );

    const loadMoreSearch$: Observable<SearchTrigger> = this.loadMore$.pipe(
      filter(() => this.currentQuery.trim().length > 0),
      map(() => {
        this.currentOffset += this.pageSize;
        return { query: this.currentQuery, offset: this.currentOffset, append: true };
      })
    );

    // Combine both trigger streams
    this.searchState$ = merge(newSearch$, loadMoreSearch$).pipe(
      tap(() => this.isLoading$.next(true)),
      switchMap(trigger => {
        if (!trigger.query.trim()) {
          return of({ results: [], total: 0, hasMore: false, error: null, append: false });
        }

        return this.searchService.search({
          q: trigger.query,
          limit: this.pageSize,
          offset: trigger.offset
        }).pipe(
          map(response => ({
            results: response.data,
            total: response.meta.total,
            hasMore: response.meta.hasMore,
            error: null,
            append: trigger.append
          })),
          catchError(err => {
            console.error('Search error:', err);
            return of({
              results: [] as SearchResult[],
              total: 0,
              hasMore: false,
              error: 'Failed to search. Please try again.',
              append: trigger.append
            });
          })
        );
      }),
      scan((acc, curr) => {
        // If append mode, combine results; otherwise replace
        if (curr.append && !curr.error) {
          return {
            results: [...acc.results, ...curr.results],
            total: curr.total,
            hasMore: curr.hasMore,
            error: null
          };
        }
        return {
          results: curr.results,
          total: curr.total,
          hasMore: curr.hasMore,
          error: curr.error
        };
      }, { results: [], total: 0, hasMore: false, error: null } as SearchState),
      tap(() => this.isLoading$.next(false)),
      shareReplay(1)
    );
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Load more results (triggers load more stream)
   */
  loadMore(): void {
    this.loadMore$.next();
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
