import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { Observable, Subject, combineLatest } from 'rxjs';
import { filter, take, takeUntil, map } from 'rxjs/operators';
import { NavigationService } from '../../core/services/navigation.service';
import { NavTree } from '../../core/models/wiki.model';
import { LucideAngularModule, ChevronRight, ChevronDown, LayoutGrid } from 'lucide-angular';

@Component({
  selector: 'app-left-sidebar',
  imports: [CommonModule, FormsModule, RouterModule, LucideAngularModule],
  templateUrl: './left-sidebar.html',
  styleUrl: './left-sidebar.css',
})
export class LeftSidebar implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  currentUrl = '';
  filteredNavTree$!: Observable<NavTree | null>;
  combinedExpandedSections$!: Observable<Set<number>>;
  combinedExpandedWikis$!: Observable<Set<number>>;
  filterTerm = '';

  // Icons for template
  readonly ChevronRight = ChevronRight;
  readonly ChevronDown = ChevronDown;
  readonly LayoutGrid = LayoutGrid;

  constructor(
    private router: Router,
    private navigationService: NavigationService
  ) {
    this.currentUrl = this.router.url;

    // Track route changes for active highlighting and auto-expand
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      takeUntil(this.destroy$)
    ).subscribe((event: NavigationEnd) => {
      this.currentUrl = event.url;
      this.handleRouteChange(event.url);
    });
  }

  ngOnInit(): void {
    // Get filtered navigation tree observable
    this.filteredNavTree$ = this.navigationService.filteredNavTree$;

    // Combine user-expanded state with filter-expanded state
    this.combinedExpandedSections$ = combineLatest([
      this.navigationService.expandedSections$,
      this.navigationService.filterExpandedSections$
    ]).pipe(
      map(([userExpanded, filterExpanded]) => {
        const combined = new Set(userExpanded);
        filterExpanded.forEach(id => combined.add(id));
        return combined;
      })
    );

    this.combinedExpandedWikis$ = combineLatest([
      this.navigationService.expandedWikis$,
      this.navigationService.filterExpandedWikis$
    ]).pipe(
      map(([userExpanded, filterExpanded]) => {
        const combined = new Set(userExpanded);
        filterExpanded.forEach(id => combined.add(id));
        return combined;
      })
    );

    // Load navigation data
    this.navigationService.loadNavigation().subscribe();

    // Auto-expand for initial route
    this.handleRouteChange(this.currentUrl);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Handle route changes - auto-expand wiki and section if on a page URL
   */
  private handleRouteChange(url: string): void {
    // Parse URL pattern: /wiki/:wikiSlug/:sectionSlug/:pageSlug
    const pageMatch = url.match(/^\/wiki\/([^\/]+)\/([^\/]+)\/([^\/]+)/);
    if (pageMatch) {
      const [, wikiSlug, sectionSlug] = pageMatch;
      this.navigationService.autoExpandForPage(wikiSlug, sectionSlug);
      return;
    }

    // Parse URL pattern: /wiki/:wikiSlug/:sectionSlug (section page)
    const sectionMatch = url.match(/^\/wiki\/([^\/]+)\/([^\/]+)/);
    if (sectionMatch) {
      const [, wikiSlug, sectionSlug] = sectionMatch;
      this.navigationService.autoExpandForPage(wikiSlug, sectionSlug);
      return;
    }

    // Parse URL pattern: /wiki/:wikiSlug (wiki page - expand wiki only)
    const wikiMatch = url.match(/^\/wiki\/([^\/]+)$/);
    if (wikiMatch) {
      const [, wikiSlug] = wikiMatch;
      // Find the wiki and expand it (one-time subscription)
      this.navigationService.navTree$.pipe(
        filter(navTree => navTree !== null),
        take(1)
      ).subscribe(navTree => {
        if (navTree) {
          const wiki = navTree.wikis.find(w => w.slug === wikiSlug);
          if (wiki) {
            this.navigationService.expandWiki(wiki.id);
          }
        }
      });
    }
  }

  /**
   * Toggle wiki expand/collapse
   */
  toggleWiki(wikiId: number, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.navigationService.toggleWiki(wikiId);
  }

  /**
   * Check if a wiki is expanded
   */
  isWikiExpanded(wikiId: number): boolean {
    return this.navigationService.isWikiExpanded(wikiId);
  }

  /**
   * Toggle section expand/collapse
   */
  toggleSection(sectionId: number, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.navigationService.toggleSection(sectionId);
  }

  /**
   * Check if a section is expanded
   */
  isExpanded(sectionId: number): boolean {
    return this.navigationService.isExpanded(sectionId);
  }

  /**
   * Check if current URL is within a wiki
   */
  isWikiActive(wikiSlug: string): boolean {
    return this.currentUrl.startsWith(`/wiki/${wikiSlug}`);
  }

  /**
   * Check if current URL is within a section
   */
  isSectionActive(wikiSlug: string, sectionSlug: string): boolean {
    return this.currentUrl.startsWith(`/wiki/${wikiSlug}/${sectionSlug}`);
  }

  /**
   * Check if current URL matches a specific page
   */
  isPageActive(wikiSlug: string, sectionSlug: string, pageSlug: string): boolean {
    return this.currentUrl === `/wiki/${wikiSlug}/${sectionSlug}/${pageSlug}`;
  }

  // ============ Filter Methods ============

  /**
   * Handle filter input changes
   */
  onFilterInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.filterTerm = input.value;
    this.navigationService.setFilterTerm(this.filterTerm);
  }

  /**
   * Handle keydown events on filter input
   */
  onFilterKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.clearFilter();
    }
  }

  /**
   * Clear the filter
   */
  clearFilter(): void {
    this.filterTerm = '';
    this.navigationService.clearFilter();
  }
}
