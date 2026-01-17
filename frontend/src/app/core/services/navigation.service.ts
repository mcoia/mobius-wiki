import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map, shareReplay, tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { NavTree, NavWiki, NavSection } from '../models/wiki.model';

@Injectable({
  providedIn: 'root'
})
export class NavigationService {
  private navTreeSubject = new BehaviorSubject<NavTree | null>(null);
  private expandedSectionsSubject = new BehaviorSubject<Set<number>>(new Set());
  private isLoadingSubject = new BehaviorSubject<boolean>(false);

  // Public observables
  navTree$ = this.navTreeSubject.asObservable();
  expandedSections$ = this.expandedSectionsSubject.asObservable();
  isLoading$ = this.isLoadingSubject.asObservable();

  constructor(private api: ApiService) {
    // Load expanded sections from localStorage
    this.loadExpandedSections();
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

  /**
   * Auto-expand the section containing the given page (by wiki/section slug)
   */
  autoExpandForPage(wikiSlug: string, sectionSlug: string): void {
    const tree = this.navTreeSubject.value;
    if (!tree) return;

    // Find the wiki
    const wiki = tree.wikis.find(w => w.slug === wikiSlug);
    if (!wiki) return;

    // Find the section
    const section = wiki.sections.find(s => s.slug === sectionSlug);
    if (!section) return;

    // Expand it
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
}
