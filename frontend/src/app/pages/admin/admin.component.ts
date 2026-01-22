import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { StaffAccountsComponent } from './staff-accounts/staff-accounts.component';
import { SiteSettingsComponent } from './site-settings/site-settings.component';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, RouterModule, StaffAccountsComponent, SiteSettingsComponent],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.css',
})
export class AdminComponent {
  activeTab: 'staff' | 'settings' = 'staff';

  setActiveTab(tab: 'staff' | 'settings'): void {
    this.activeTab = tab;
  }
}
