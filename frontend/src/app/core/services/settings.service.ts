import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap, shareReplay, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { ApiService } from './api.service';

/**
 * Upload limit configuration from backend
 */
export interface UploadLimitConfig {
  maxUploadSizeMb: number;
  maxUploadSizeBytes: number;
}

/**
 * Service for fetching public site settings.
 * Caches values to avoid repeated API calls.
 */
@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private uploadLimit$: Observable<UploadLimitConfig> | null = null;
  private uploadLimitCache = new BehaviorSubject<UploadLimitConfig | null>(null);

  constructor(private api: ApiService) {}

  /**
   * Get upload limit configuration.
   * Returns cached observable with shareReplay for efficiency.
   */
  getUploadLimit(): Observable<UploadLimitConfig> {
    if (!this.uploadLimit$) {
      this.uploadLimit$ = this.api.get<UploadLimitConfig>('/settings/public/upload-limit').pipe(
        tap(config => this.uploadLimitCache.next(config)),
        shareReplay(1),
        catchError(error => {
          console.error('Failed to load upload limit settings:', error);
          // Return default on error
          const defaultConfig: UploadLimitConfig = {
            maxUploadSizeMb: 50,
            maxUploadSizeBytes: 50 * 1024 * 1024
          };
          this.uploadLimitCache.next(defaultConfig);
          return of(defaultConfig);
        })
      );
    }
    return this.uploadLimit$;
  }

  /**
   * Synchronous getter for cached upload limit.
   * Returns null if not yet loaded.
   */
  get currentUploadLimit(): UploadLimitConfig | null {
    return this.uploadLimitCache.getValue();
  }

  /**
   * Clear cached upload limit to force refresh on next call.
   */
  refreshUploadLimit(): void {
    this.uploadLimit$ = null;
    this.uploadLimitCache.next(null);
  }
}
