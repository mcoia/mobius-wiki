import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { LibraryStaffComponent } from './library-staff/library-staff.component';
import { LibrariesComponent } from './libraries/libraries.component';
import { ContentAccessComponent } from './content-access/content-access.component';
import { AnalyticsComponent } from './analytics/analytics.component';

type TabType = 'library-staff' | 'libraries' | 'content-access' | 'analytics';

@Component({
  selector: 'app-staff',
  standalone: true,
  imports: [CommonModule, RouterModule, LibraryStaffComponent, LibrariesComponent, ContentAccessComponent, AnalyticsComponent],
  templateUrl: './staff.component.html',
  styleUrl: './staff.component.css',
})
export class StaffComponent implements OnInit {
  activeTab: TabType = 'library-staff';

  private readonly validTabs: TabType[] = ['library-staff', 'libraries', 'content-access', 'analytics'];

  constructor(
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      const tab = params['tab'];
      if (this.isValidTab(tab)) {
        this.activeTab = tab;
      }
    });
  }

  setActiveTab(tab: TabType): void {
    this.activeTab = tab;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge',
      replaceUrl: false
    });
  }

  private isValidTab(tab: string): tab is TabType {
    return this.validTabs.includes(tab as TabType);
  }
}
