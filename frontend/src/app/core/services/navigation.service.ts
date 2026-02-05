import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, combineLatest } from 'rxjs';
import { catchError, map, shareReplay, tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { NavTree, NavWiki, NavSection, NavPage } from '../models/wiki.model';

@Injectable({
  providedIn: 'root'
})
export class NavigationService {
  private navTreeSubject = new BehaviorSubject<NavTree | null>(null);
  private expandedSectionsSubject = new BehaviorSubject<Set<number>>(new Set());
  private expandedWikisSubject = new BehaviorSubject<Set<number>>(new Set());
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  private filterTermSubject = new BehaviorSubject<string>('');

  // Public observables
  navTree$ = this.navTreeSubject.asObservable();
  expandedSections$ = this.expandedSectionsSubject.asObservable();
  expandedWikis$ = this.expandedWikisSubject.asObservable();
  isLoading$ = this.isLoadingSubject.asObservable();
  filterTerm$ = this.filterTermSubject.asObservable();

  // Filtered navigation tree and auto-expand sets for filter matches
  filteredNavTree$: Observable<NavTree | null>;
  filterExpandedSections$: Observable<Set<number>>;
  filterExpandedWikis$: Observable<Set<number>>;

  constructor(private api: ApiService) {
    // Load expanded state from localStorage
    this.loadExpandedSections();
    this.loadExpandedWikis();

    // Create filtered nav tree observable
    this.filteredNavTree$ = combineLatest([
      this.navTree$,
      this.filterTerm$
    ]).pipe(
      map(([tree, term]) => this.filterNavTree(tree, term)),
      shareReplay(1)
    );

    // Create auto-expand observables for filter matches
    this.filterExpandedSections$ = combineLatest([
      this.navTree$,
      this.filterTerm$
    ]).pipe(
      map(([tree, term]) => this.getFilterExpandedSections(tree, term)),
      shareReplay(1)
    );

    this.filterExpandedWikis$ = combineLatest([
      this.navTree$,
      this.filterTerm$
    ]).pipe(
      map(([tree, term]) => this.getFilterExpandedWikis(tree, term)),
      shareReplay(1)
    );
  }

  /**
   * Load the navigation tree from the backend
   */
  loadNavigation(): Observable<NavTree> {
    this.isLoadingSubject.next(true);

    return this.api.get<{ data: NavTree }>('/navigation/tree').pipe(
      map(response => response.data),
      tap(tree => {
        this.navTreeSubject.next(tree);
        this.isLoadingSubject.next(false);
      }),
      catchError(error => {
        console.error('Failed to load navigation tree:', error);
        this.isLoadingSubject.next(false);
        this.navTreeSubject.next({ wikis: [] });
        return of({ wikis: [] });
      }),
      shareReplay(1)
    );
  }

  /**
   * Toggle a section's expanded state
   */
  toggleSection(sectionId: number): void {
    const current = this.expandedSectionsSubject.value;
    const updated = new Set(current);

    if (updated.has(sectionId)) {
      updated.delete(sectionId);
    } else {
      updated.add(sectionId);
    }

    this.expandedSectionsSubject.next(updated);
    this.saveExpandedSections(updated);
  }

  /**
   * Expand a specific section
   */
  expandSection(sectionId: number): void {
    const current = this.expandedSectionsSubject.value;
    if (!current.has(sectionId)) {
      const updated = new Set(current);
      updated.add(sectionId);
      this.expandedSectionsSubject.next(updated);
      this.saveExpandedSections(updated);
    }
  }

  /**
   * Collapse a specific section
   */
  collapseSection(sectionId: number): void {
    const current = this.expandedSectionsSubject.value;
    if (current.has(sectionId)) {
      const updated = new Set(current);
      updated.delete(sectionId);
      this.expandedSectionsSubject.next(updated);
      this.saveExpandedSections(updated);
    }
  }

  /**
   * Check if a section is expanded
   */
  isExpanded(sectionId: number): boolean {
    return this.expandedSectionsSubject.value.has(sectionId);
  }

  // Wiki expand/collapse methods

  /**
   * Toggle a wiki's expanded state
   */
  toggleWiki(wikiId: number): void {
    const current = this.expandedWikisSubject.value;
    const updated = new Set(current);

    if (updated.has(wikiId)) {
      updated.delete(wikiId);
    } else {
      updated.add(wikiId);
    }

    this.expandedWikisSubject.next(updated);
    this.saveExpandedWikis(updated);
  }

  /**
   * Expand a specific wiki
   */
  expandWiki(wikiId: number): void {
    const current = this.expandedWikisSubject.value;
    if (!current.has(wikiId)) {
      const updated = new Set(current);
      updated.add(wikiId);
      this.expandedWikisSubject.next(updated);
      this.saveExpandedWikis(updated);
    }
  }

  /**
   * Collapse a specific wiki
   */
  collapseWiki(wikiId: number): void {
    const current = this.expandedWikisSubject.value;
    if (current.has(wikiId)) {
      const updated = new Set(current);
      updated.delete(wikiId);
      this.expandedWikisSubject.next(updated);
      this.saveExpandedWikis(updated);
    }
  }

  /**
   * Check if a wiki is expanded
   */
  isWikiExpanded(wikiId: number): boolean {
    return this.expandedWikisSubject.value.has(wikiId);
  }

  /**
   * Auto-expand the wiki and section containing the given page (by wiki/section slug)
   */
  autoExpandForPage(wikiSlug: string, sectionSlug: string): void {
    const tree = this.navTreeSubject.value;
    if (!tree) return;

    // Find the wiki
    const wiki = tree.wikis.find(w => w.slug === wikiSlug);
    if (!wiki) return;

    // Expand the wiki first
    this.expandWiki(wiki.id);

    // Find and expand the section
    const section = wiki.sections.find(s => s.slug === sectionSlug);
    if (!section) return;

    this.expandSection(section.id);
  }

  /**
   * Refresh navigation (call after page/section/wiki changes)
   */
  refresh(): void {
    this.loadNavigation().subscribe();
  }

  // localStorage helpers
  private loadExpandedSections(): void {
    try {
      const stored = localStorage.getItem('nav_expanded_sections');
      if (stored) {
        const ids = JSON.parse(stored) as number[];
        this.expandedSectionsSubject.next(new Set(ids));
      }
    } catch {
      // Ignore localStorage errors
    }
  }

  private saveExpandedSections(sections: Set<number>): void {
    try {
      localStorage.setItem('nav_expanded_sections', JSON.stringify(Array.from(sections)));
    } catch {
      // Ignore localStorage errors
    }
  }

  private loadExpandedWikis(): void {
    try {
      const stored = localStorage.getItem('nav_expanded_wikis');
      if (stored) {
        const ids = JSON.parse(stored) as number[];
        this.expandedWikisSubject.next(new Set(ids));
      }
    } catch {
      // Ignore localStorage errors
    }
  }

  private saveExpandedWikis(wikis: Set<number>): void {
    try {
      localStorage.setItem('nav_expanded_wikis', JSON.stringify(Array.from(wikis)));
    } catch {
      // Ignore localStorage errors
    }
  }

  // ============ Filter Methods ============

  /**
   * Set the filter term for sidebar filtering
   */
  setFilterTerm(term: string): void {
    this.filterTermSubject.next(term);
  }

  /**
   * Clear the filter
   */
  clearFilter(): void {
    this.filterTermSubject.next('');
  }

  /**
   * Get current filter term
   */
  getFilterTerm(): string {
    return this.filterTermSubject.value;
  }

  /**
   * Filter the navigation tree based on search term
   */
  private filterNavTree(tree: NavTree | null, term: string): NavTree | null {
    if (!tree || !term.trim()) {
      return tree;
    }

    const lowerTerm = term.toLowerCase().trim();
    const filteredWikis: NavWiki[] = [];

    for (const wiki of tree.wikis) {
      const filteredWiki = this.filterWiki(wiki, lowerTerm);
      if (filteredWiki) {
        filteredWikis.push(filteredWiki);
      }
    }

    return { wikis: filteredWikis };
  }

  /**
   * Filter a single wiki and its sections
   */
  private filterWiki(wiki: NavWiki, term: string): NavWiki | null {
    // Check if wiki title matches
    const wikiMatches = wiki.title.toLowerCase().includes(term);

    const filteredSections: NavSection[] = [];

    for (const section of wiki.sections) {
      const filteredSection = this.filterSection(section, term);
      if (filteredSection) {
        filteredSections.push(filteredSection);
      }
    }

    // Include wiki if it matches or has matching sections
    if (wikiMatches || filteredSections.length > 0) {
      return {
        ...wiki,
        sections: wikiMatches ? wiki.sections : filteredSections
      };
    }

    return null;
  }

  /**
   * Filter a single section and its pages
   */
  private filterSection(section: NavSection, term: string): NavSection | null {
    // Check if section title matches
    const sectionMatches = section.title.toLowerCase().includes(term);

    // Filter pages by title
    const filteredPages = section.pages.filter(page =>
      page.title.toLowerCase().includes(term)
    );

    // Include section if it matches or has matching pages
    if (sectionMatches || filteredPages.length > 0) {
      return {
        ...section,
        pages: sectionMatches ? section.pages : filteredPages
      };
    }

    return null;
  }

  /**
   * Get sections that should be auto-expanded due to filter matches
   */
  private getFilterExpandedSections(tree: NavTree | null, term: string): Set<number> {
    const expanded = new Set<number>();

    if (!tree || !term.trim()) {
      return expanded;
    }

    const lowerTerm = term.toLowerCase().trim();

    for (const wiki of tree.wikis) {
      for (const section of wiki.sections) {
        // Expand section if any page matches
        const hasMatchingPage = section.pages.some(page =>
          page.title.toLowerCase().includes(lowerTerm)
        );

        if (hasMatchingPage) {
          expanded.add(section.id);
        }
      }
    }

    return expanded;
  }

  /**
   * Get wikis that should be auto-expanded due to filter matches
   */
  private getFilterExpandedWikis(tree: NavTree | null, term: string): Set<number> {
    const expanded = new Set<number>();

    if (!tree || !term.trim()) {
      return expanded;
    }

    const lowerTerm = term.toLowerCase().trim();

    for (const wiki of tree.wikis) {
      // Expand wiki if any section or page matches
      const hasMatch = wiki.sections.some(section =>
        section.title.toLowerCase().includes(lowerTerm) ||
        section.pages.some(page => page.title.toLowerCase().includes(lowerTerm))
      );

      if (hasMatch) {
        expanded.add(wiki.id);
      }
    }

    return expanded;
  }
}
