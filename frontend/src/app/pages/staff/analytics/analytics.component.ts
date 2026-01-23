import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { switchMap, catchError, shareReplay, map } from 'rxjs/operators';
import { BaseChartDirective } from 'ng2-charts';
import { Chart, ChartConfiguration, ChartData, registerables } from 'chart.js';

import { AnalyticsService } from '../../../core/services/analytics.service';
import { ToastService } from '../../../core/services/toast.service';
import { OverallStats, PopularPage, DailyViewsResponse } from '../../../core/models/analytics.model';

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
  stats$!: Observable<OverallStats | null>;
  popularPages$!: Observable<PopularPage[]>;
  dailyViews$!: Observable<DailyViewsResponse | null>;

  // Chart data observables
  doughnutChartData$!: Observable<ChartData<'doughnut'> | null>;
  lineChartData$!: Observable<ChartData<'line'> | null>;

  selectedPeriod: number | undefined = 30;
  private refreshTrigger$ = new BehaviorSubject<void>(undefined);

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

  constructor(
    private analyticsService: AnalyticsService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  private loadData(): void {
    this.stats$ = this.refreshTrigger$.pipe(
      switchMap(() => this.analyticsService.getOverallStats(this.selectedPeriod)),
      catchError(error => {
        console.error('Failed to load stats:', error);
        this.toastService.error('Failed to load analytics data');
        return of(null);
      }),
      shareReplay(1)
    );

    this.popularPages$ = this.refreshTrigger$.pipe(
      switchMap(() => this.analyticsService.getPopularPages(10, this.selectedPeriod)),
      catchError(error => {
        console.error('Failed to load popular pages:', error);
        return of([]);
      }),
      shareReplay(1)
    );

    this.dailyViews$ = this.refreshTrigger$.pipe(
      switchMap(() => this.analyticsService.getDailyViews(this.selectedPeriod || 30)),
      catchError(error => {
        console.error('Failed to load daily views:', error);
        return of(null);
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
}
