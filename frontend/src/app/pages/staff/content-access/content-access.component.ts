import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { switchMap, catchError, shareReplay, map } from 'rxjs/operators';
import { StaffService } from '../../../core/services/staff.service';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { AccessRule } from '../../../core/models/staff.model';

interface AccessRuleFilters {
  ruleableType: string;
  ruleType: string;
}

@Component({
  selector: 'app-content-access',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './content-access.component.html',
  styleUrl: './content-access.component.css',
})
export class ContentAccessComponent implements OnInit {
  accessRules$!: Observable<AccessRule[]>;
  private refreshTrigger$ = new BehaviorSubject<AccessRuleFilters>({ ruleableType: '', ruleType: '' });

  // Filter state
  filters: AccessRuleFilters = { ruleableType: '', ruleType: '' };

  // Available filter options
  ruleableTypes = [
    { value: '', label: 'All Types' },
    { value: 'wiki', label: 'Wiki' },
    { value: 'section', label: 'Section' },
    { value: 'page', label: 'Page' },
    { value: 'file', label: 'File' }
  ];

  ruleTypes = [
    { value: '', label: 'All Rules' },
    { value: 'public', label: 'Public' },
    { value: 'authenticated', label: 'Authenticated' },
    { value: 'library', label: 'Library' },
    { value: 'role', label: 'Role' }
  ];

  constructor(
    private staffService: StaffService,
    private toastService: ToastService,
    private confirmDialogService: ConfirmDialogService
  ) {}

  ngOnInit(): void {
    this.accessRules$ = this.refreshTrigger$.pipe(
      switchMap(filters => {
        const queryFilters: { ruleableType?: string; ruleType?: string } = {};
        if (filters.ruleableType) queryFilters.ruleableType = filters.ruleableType;
        if (filters.ruleType) queryFilters.ruleType = filters.ruleType;
        return this.staffService.getAccessRules(queryFilters);
      }),
      map(response => response.data),
      catchError(error => {
        console.error('Failed to load access rules:', error);
        this.toastService.error('Failed to load access rules');
        return of([]);
      }),
      shareReplay(1)
    );
  }

  applyFilters(): void {
    this.refreshTrigger$.next({ ...this.filters });
  }

  clearFilters(): void {
    this.filters = { ruleableType: '', ruleType: '' };
    this.applyFilters();
  }

  refreshRules(): void {
    this.refreshTrigger$.next({ ...this.filters });
  }

  // Delete access rule
  deleteRule(rule: AccessRule): void {
    const contentName = rule.ruleableName || `ID ${rule.ruleableId}`;
    this.confirmDialogService.open({
      title: 'Delete Access Rule',
      message: `Are you sure you want to delete this ${rule.ruleType} rule for "${contentName}"? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      type: 'danger'
    }).subscribe(confirmed => {
      if (!confirmed) return;

      this.staffService.deleteAccessRule(rule.id).subscribe({
        next: () => {
          this.toastService.success('Access rule deleted successfully');
          this.refreshRules();
        },
        error: (error) => {
          console.error('Failed to delete access rule:', error);
          this.toastService.error('Failed to delete access rule');
        }
      });
    });
  }

  // Format rule value for display
  formatRuleValue(rule: AccessRule): string {
    if (!rule.ruleValue) return '-';
    if (rule.ruleType === 'library') return rule.ruleValue;
    if (rule.ruleType === 'role') return rule.ruleValue;
    return rule.ruleValue;
  }

  // Get badge class for ruleable type
  getRuleableTypeBadgeClass(type: string): string {
    const classes: Record<string, string> = {
      wiki: 'badge-wiki',
      section: 'badge-section',
      page: 'badge-page',
      file: 'badge-file'
    };
    return classes[type] || '';
  }

  // Get badge class for rule type
  getRuleTypeBadgeClass(type: string): string {
    const classes: Record<string, string> = {
      public: 'badge-public',
      authenticated: 'badge-authenticated',
      library: 'badge-library',
      role: 'badge-role'
    };
    return classes[type] || '';
  }
}
