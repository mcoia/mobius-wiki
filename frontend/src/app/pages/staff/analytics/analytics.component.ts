import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { switchMap, catchError, shareReplay, map } from 'rxjs/operators';
import { BaseChartDirective } from 'ng2-charts';
import { Chart, ChartConfiguration, ChartData, registerables } from 'chart.js';

import { AnalyticsService } from '../../../core/services/analytics.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  OverallStats,
  PopularPage,
  DailyViewsResponse,
  WikiStats,
  SectionStats,
  UserContribution,
  CreationTrend,
  ContentHealth,
  ReferrerStats,
} from '../../../core/models/analytics.model';

// Register Chart.js components
Chart.register(...registerables);

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [CommonModule, RouterModule, BaseChartDirective],
  templateUrl: './analytics.component.html',
  styleUrl: './analytics.component.css',
})
export class AnalyticsComponent implements OnInit {
  // Existing observables
  stats$!: Observable<OverallStats | null>;
  popularPages$!: Observable<PopularPage[]>;
  dailyViews$!: Observable<DailyViewsResponse | null>;

  // New observables
  wikiStats$!: Observable<WikiStats[]>;
  sectionStats$!: Observable<SectionStats[]>;
  userContributions$!: Observable<UserContribution[]>;
  contentTrends$!: Observable<CreationTrend[]>;
  contentHealth$!: Observable<ContentHealth | null>;
  referrerStats$!: Observable<ReferrerStats[]>;

  // Chart data observables
  doughnutChartData$!: Observable<ChartData<'doughnut'> | null>;
  lineChartData$!: Observable<ChartData<'line'> | null>;
  wikiBarChartData$!: Observable<ChartData<'bar'> | null>;
  sectionBarChartData$!: Observable<ChartData<'bar'> | null>;
  contentTrendsChartData$!: Observable<ChartData<'line'> | null>;
  referrerChartData$!: Observable<ChartData<'bar'> | null>;

  selectedPeriod: number | undefined = 30;
  private refreshTrigger$ = new BehaviorSubject<void>(undefined);

  // Content health expanded states
  showOrphaned = false;
  showStale = false;
  showDrafts = false;

  // Chart configurations
  doughnutChartOptions: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          padding: 16,
          usePointStyle: true,
        },
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const label = context.label || '';
            const value = context.parsed || 0;
            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            return `${label}: ${value} (${percentage}%)`;
          },
        },
      },
    },
  };

  lineChartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        mode: 'index',
        intersect: false,
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          maxTicksLimit: 7,
        },
      },
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
        },
        ticks: {
          stepSize: 1,
        },
      },
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false,
    },
  };

  horizontalBarChartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (context) => `${context.parsed.x} views`,
        },
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
        },
      },
      y: {
        grid: {
          display: false,
        },
      },
    },
  };

  contentTrendsChartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          usePointStyle: true,
          padding: 16,
        },
      },
      tooltip: {
        mode: 'index',
        intersect: false,
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          maxTicksLimit: 7,
        },
      },
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
        },
        ticks: {
          stepSize: 1,
        },
      },
    },
  };

  constructor(
    private analyticsService: AnalyticsService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  private loadData(): void {
    // Overall stats
    this.stats$ = this.refreshTrigger$.pipe(
      switchMap(() => this.analyticsService.getOverallStats(this.selectedPeriod)),
      catchError(error => {
        console.error('Failed to load stats:', error);
        this.toastService.error('Failed to load analytics data');
        return of(null);
      }),
      shareReplay(1)
    );

    // Popular pages
    this.popularPages$ = this.refreshTrigger$.pipe(
      switchMap(() => this.analyticsService.getPopularPages(10, this.selectedPeriod)),
      catchError(error => {
        console.error('Failed to load popular pages:', error);
        return of([]);
      }),
      shareReplay(1)
    );

    // Daily views
    this.dailyViews$ = this.refreshTrigger$.pipe(
      switchMap(() => this.analyticsService.getDailyViews(this.selectedPeriod || 30)),
      catchError(error => {
        console.error('Failed to load daily views:', error);
        return of(null);
      }),
      shareReplay(1)
    );

    // Wiki stats
    this.wikiStats$ = this.refreshTrigger$.pipe(
      switchMap(() => this.analyticsService.getWikiStats(this.selectedPeriod)),
      catchError(error => {
        console.error('Failed to load wiki stats:', error);
        return of([]);
      }),
      shareReplay(1)
    );

    // Section stats
    this.sectionStats$ = this.refreshTrigger$.pipe(
      switchMap(() => this.analyticsService.getSectionStats(this.selectedPeriod, 10)),
      catchError(error => {
        console.error('Failed to load section stats:', error);
        return of([]);
      }),
      shareReplay(1)
    );

    // User contributions
    this.userContributions$ = this.refreshTrigger$.pipe(
      switchMap(() => this.analyticsService.getUserContributions(this.selectedPeriod, 10)),
      catchError(error => {
        console.error('Failed to load user contributions:', error);
        return of([]);
      }),
      shareReplay(1)
    );

    // Content trends
    this.contentTrends$ = this.refreshTrigger$.pipe(
      switchMap(() => this.analyticsService.getContentTrends(this.selectedPeriod || 30)),
      catchError(error => {
        console.error('Failed to load content trends:', error);
        return of([]);
      }),
      shareReplay(1)
    );

    // Content health
    this.contentHealth$ = this.refreshTrigger$.pipe(
      switchMap(() => this.analyticsService.getContentHealth()),
      catchError(error => {
        console.error('Failed to load content health:', error);
        return of(null);
      }),
      shareReplay(1)
    );

    // Referrer stats
    this.referrerStats$ = this.refreshTrigger$.pipe(
      switchMap(() => this.analyticsService.getReferrerStats(this.selectedPeriod, 10)),
      catchError(error => {
        console.error('Failed to load referrer stats:', error);
        return of([]);
      }),
      shareReplay(1)
    );

    // Transform stats into doughnut chart data
    this.doughnutChartData$ = this.stats$.pipe(
      map(stats => {
        if (!stats) return null;
        return {
          labels: ['Wikis', 'Sections', 'Pages', 'Files'],
          datasets: [{
            data: [
              stats.content.wikis,
              stats.content.sections,
              stats.content.pages,
              stats.content.files,
            ],
            backgroundColor: [
              '#0891B2', // teal-600
              '#0D9488', // teal-500
              '#14B8A6', // teal-400
              '#5EEAD4', // teal-300
            ],
            borderWidth: 0,
            hoverOffset: 4,
          }],
        };
      })
    );

    // Transform daily views into line chart data
    this.lineChartData$ = this.dailyViews$.pipe(
      map(response => {
        if (!response || response.data.length === 0) return null;
        return {
          labels: response.data.map(d => this.formatDate(d.date)),
          datasets: [{
            data: response.data.map(d => d.views),
            borderColor: '#0891B2',
            backgroundColor: 'rgba(8, 145, 178, 0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 2,
            pointHoverRadius: 6,
            pointBackgroundColor: '#0891B2',
          }],
        };
      })
    );

    // Wiki performance bar chart
    this.wikiBarChartData$ = this.wikiStats$.pipe(
      map(stats => {
        if (!stats || stats.length === 0) return null;
        return {
          labels: stats.map(s => s.wikiTitle),
          datasets: [{
            data: stats.map(s => s.viewCount),
            backgroundColor: '#0891B2',
            borderRadius: 4,
            barThickness: 20,
          }],
        };
      })
    );

    // Section performance bar chart
    this.sectionBarChartData$ = this.sectionStats$.pipe(
      map(stats => {
        if (!stats || stats.length === 0) return null;
        return {
          labels: stats.map(s => s.sectionTitle),
          datasets: [{
            data: stats.map(s => s.viewCount),
            backgroundColor: '#14B8A6',
            borderRadius: 4,
            barThickness: 20,
          }],
        };
      })
    );

    // Content trends line chart
    this.contentTrendsChartData$ = this.contentTrends$.pipe(
      map(trends => {
        if (!trends || trends.length === 0) return null;
        return {
          labels: trends.map(t => this.formatDate(t.date)),
          datasets: [
            {
              label: 'Pages Created',
              data: trends.map(t => t.pagesCreated),
              borderColor: '#0891B2',
              backgroundColor: 'rgba(8, 145, 178, 0.1)',
              fill: false,
              tension: 0.4,
              pointRadius: 2,
              pointHoverRadius: 6,
            },
            {
              label: 'Edits Made',
              data: trends.map(t => t.versionsCreated),
              borderColor: '#14B8A6',
              backgroundColor: 'rgba(20, 184, 166, 0.1)',
              fill: false,
              tension: 0.4,
              pointRadius: 2,
              pointHoverRadius: 6,
            },
          ],
        };
      })
    );

    // Referrer bar chart
    this.referrerChartData$ = this.referrerStats$.pipe(
      map(stats => {
        if (!stats || stats.length === 0) return null;
        return {
          labels: stats.map(s => s.domain),
          datasets: [{
            data: stats.map(s => s.viewCount),
            backgroundColor: '#6366F1',
            borderRadius: 4,
            barThickness: 20,
          }],
        };
      })
    );
  }

  private formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  setPeriod(days: number | undefined): void {
    this.selectedPeriod = days;
    this.loadData();
    this.refreshTrigger$.next();
  }

  refresh(): void {
    this.refreshTrigger$.next();
  }

  getPageUrl(page: PopularPage): string {
    return `/wiki/${page.wiki.slug}/${page.section.slug}/${page.page.slug}`;
  }

  toggleOrphaned(): void {
    this.showOrphaned = !this.showOrphaned;
  }

  toggleStale(): void {
    this.showStale = !this.showStale;
  }

  toggleDrafts(): void {
    this.showDrafts = !this.showDrafts;
  }
}
