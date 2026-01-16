import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface TocItem {
  id: string;      // DOM id for scrolling
  text: string;    // Heading text
  level: number;   // 1-6 for h1-h6
}

export interface TocState {
  items: TocItem[];
  activeId: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class TocService {
  private stateSubject = new BehaviorSubject<TocState>({
    items: [],
    activeId: null
  });

  /** Observable of the full TOC state */
  public state$ = this.stateSubject.asObservable();

  /** Observable of just the heading items */
  public headings$: Observable<TocItem[]> = this.state$.pipe(
    map(state => state.items)
  );

  /** Observable of the active heading ID */
  public activeId$: Observable<string | null> = this.state$.pipe(
    map(state => state.activeId)
  );

  /**
   * Set the headings for the current page
   */
  setHeadings(items: TocItem[]): void {
    this.stateSubject.next({
      ...this.stateSubject.value,
      items,
      activeId: items.length > 0 ? items[0].id : null
    });
  }

  /**
   * Set the currently active heading (for scroll tracking)
   */
  setActiveHeading(id: string | null): void {
    if (this.stateSubject.value.activeId !== id) {
      this.stateSubject.next({
        ...this.stateSubject.value,
        activeId: id
      });
    }
  }

  /**
   * Clear all headings (called on navigation or cleanup)
   */
  clearHeadings(): void {
    this.stateSubject.next({
      items: [],
      activeId: null
    });
  }

  /**
   * Get current state synchronously
   */
  get currentState(): TocState {
    return this.stateSubject.value;
  }
}
