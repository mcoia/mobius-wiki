import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { LibraryStaffComponent } from './library-staff/library-staff.component';
import { LibrariesComponent } from './libraries/libraries.component';
import { ContentAccessComponent } from './content-access/content-access.component';

@Component({
  selector: 'app-staff',
  standalone: true,
  imports: [CommonModule, RouterModule, LibraryStaffComponent, LibrariesComponent, ContentAccessComponent],
  templateUrl: './staff.component.html',
  styleUrl: './staff.component.css',
})
export class StaffComponent {
  activeTab: 'library-staff' | 'libraries' | 'content-access' = 'library-staff';

  setActiveTab(tab: 'library-staff' | 'libraries' | 'content-access'): void {
    this.activeTab = tab;
  }
}
