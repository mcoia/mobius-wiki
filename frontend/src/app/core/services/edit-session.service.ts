import { Injectable, OnDestroy } from '@angular/core';
import { Observable, Subject, Subscription, interval, of } from 'rxjs';
import { catchError, map, switchMap, takeUntil } from 'rxjs/operators';
import { ApiService } from './api.service';

export interface ActiveEditor {
  userId: number;
  displayName: string;
  startedAt: string;
  lastHeartbeat: string;
}

@Injectable({
  providedIn: 'root'
})
export class EditSessionService implements OnDestroy {
  private heartbeatInterval?: Subscription;
  private activeEditorsPolling?: Subscription;
  private destroy$ = new Subject<void>();
  private currentPageId?: number;

  // Heartbeat every 30 seconds
  private readonly HEARTBEAT_INTERVAL_MS = 30000;
  // Poll for active editors every 30 seconds
  private readonly POLL_INTERVAL_MS = 30000;

  constructor(private api: ApiService) {}

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.stopSession();
  }

  /**
   * Start an edit session for a page.
   * This sends an initial heartbeat and starts the heartbeat interval.
   */
  startSession(pageId: number): Observable<void> {
    this.currentPageId = pageId;

    // Send initial heartbeat
    return this.sendHeartbeat(pageId).pipe(
      map(() => {
        // Start periodic heartbeat
        this.startHeartbeatInterval(pageId);
      })
    );
  }

  /**
   * End the current edit session.
   */
  endSession(pageId: number): Observable<void> {
    this.stopHeartbeatInterval();
    this.stopActiveEditorsPolling();
    this.currentPageId = undefined;

    return this.api.delete(`/pages/${pageId}/edit-session`).pipe(
      map(() => undefined),
      catchError(err => {
        console.error('Failed to end edit session:', err);
        return of(undefined);
      })
    );
  }

  /**
   * Stop session without calling the API (for cleanup on component destroy).
   */
  stopSession(): void {
    this.stopHeartbeatInterval();
    this.stopActiveEditorsPolling();

    // Fire and forget end session if we have a current page
    if (this.currentPageId) {
      this.api.delete(`/pages/${this.currentPageId}/edit-session`).subscribe({
        error: () => {} // Ignore errors on cleanup
      });
      this.currentPageId = undefined;
    }
  }

  /**
   * Get active editors for a page (one-time call).
   */
  getActiveEditors(pageId: number): Observable<ActiveEditor[]> {
    return this.api.get<{ data: ActiveEditor[] }>(`/pages/${pageId}/edit-session/active`).pipe(
      map(response => response.data)
    );
  }

  /**
   * Start polling for active editors.
   * Returns an observable that emits the list of active editors periodically.
   */
  startActiveEditorsPolling(pageId: number): Observable<ActiveEditor[]> {
    // Stop any existing polling
    this.stopActiveEditorsPolling();

    // Create an observable that polls every POLL_INTERVAL_MS
    return interval(this.POLL_INTERVAL_MS).pipe(
      takeUntil(this.destroy$),
      switchMap(() => this.getActiveEditors(pageId)),
      catchError(err => {
        console.error('Failed to fetch active editors:', err);
        return of([]);
      })
    );
  }

  /**
   * Send a heartbeat to keep the session alive.
   */
  private sendHeartbeat(pageId: number): Observable<void> {
    return this.api.post(`/pages/${pageId}/edit-session`, {}).pipe(
      map(() => undefined),
      catchError(err => {
        console.error('Failed to send heartbeat:', err);
        return of(undefined);
      })
    );
  }

  private startHeartbeatInterval(pageId: number): void {
    this.stopHeartbeatInterval();

    this.heartbeatInterval = interval(this.HEARTBEAT_INTERVAL_MS).pipe(
      takeUntil(this.destroy$),
      switchMap(() => this.sendHeartbeat(pageId))
    ).subscribe();
  }

  private stopHeartbeatInterval(): void {
    if (this.heartbeatInterval) {
      this.heartbeatInterval.unsubscribe();
      this.heartbeatInterval = undefined;
    }
  }

  private stopActiveEditorsPolling(): void {
    if (this.activeEditorsPolling) {
      this.activeEditorsPolling.unsubscribe();
      this.activeEditorsPolling = undefined;
    }
  }
}
