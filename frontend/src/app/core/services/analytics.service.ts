import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { ApiService } from './api.service';
import { OverallStats, PopularPage, PopularPagesResponse, DailyViewsResponse } from '../models/analytics.model';

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  constructor(private api: ApiService) {}

  getOverallStats(days?: number): Observable<OverallStats> {
    const params = days ? `?days=${days}` : '';
    return this.api.get<OverallStats>(`/analytics/stats${params}`);
  }

  getPopularPages(limit: number = 10, days?: number): Observable<PopularPage[]> {
    const params = new URLSearchParams();
    params.append('limit', limit.toString());
    if (days) {
      params.append('days', days.toString());
    }
    return this.api.get<PopularPagesResponse>(`/analytics/popular?${params.toString()}`).pipe(
      map(response => response.data)
    );
  }

  getDailyViews(days: number = 30): Observable<DailyViewsResponse> {
    return this.api.get<DailyViewsResponse>(`/analytics/daily-views?days=${days}`);
  }
}
