import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { ApiService } from './api.service';
import {
  OverallStats,
  PopularPage,
  PopularPagesResponse,
  DailyViewsResponse,
  WikiStats,
  WikiStatsResponse,
  SectionStats,
  SectionStatsResponse,
  UserContribution,
  UserContributionsResponse,
  CreationTrend,
  ContentTrendsResponse,
  ContentHealth,
  ReferrerStats,
  ReferrerStatsResponse,
} from '../models/analytics.model';

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

  getWikiStats(days?: number): Observable<WikiStats[]> {
    const params = days ? `?days=${days}` : '';
    return this.api.get<WikiStatsResponse>(`/analytics/wikis${params}`).pipe(
      map(response => response.data)
    );
  }

  getSectionStats(days?: number, limit: number = 10): Observable<SectionStats[]> {
    const params = new URLSearchParams();
    if (days) params.append('days', days.toString());
    params.append('limit', limit.toString());
    return this.api.get<SectionStatsResponse>(`/analytics/sections?${params.toString()}`).pipe(
      map(response => response.data)
    );
  }

  getUserContributions(days?: number, limit: number = 10): Observable<UserContribution[]> {
    const params = new URLSearchParams();
    if (days) params.append('days', days.toString());
    params.append('limit', limit.toString());
    return this.api.get<UserContributionsResponse>(`/analytics/contributors?${params.toString()}`).pipe(
      map(response => response.data)
    );
  }

  getContentTrends(days: number = 30): Observable<CreationTrend[]> {
    return this.api.get<ContentTrendsResponse>(`/analytics/content-trends?days=${days}`).pipe(
      map(response => response.data)
    );
  }

  getContentHealth(): Observable<ContentHealth> {
    return this.api.get<ContentHealth>(`/analytics/content-health`);
  }

  getReferrerStats(days?: number, limit: number = 10): Observable<ReferrerStats[]> {
    const params = new URLSearchParams();
    if (days) params.append('days', days.toString());
    params.append('limit', limit.toString());
    return this.api.get<ReferrerStatsResponse>(`/analytics/referrers?${params.toString()}`).pipe(
      map(response => response.data)
    );
  }
}
