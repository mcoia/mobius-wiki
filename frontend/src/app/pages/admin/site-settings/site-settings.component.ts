import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { switchMap, catchError, shareReplay, map } from 'rxjs/operators';
import { AdminService } from '../../../core/services/admin.service';
import { ToastService } from '../../../core/services/toast.service';
import { Setting } from '../../../core/models/admin.model';

interface EditableSetting extends Setting {
  editValue: string;
  isEditing: boolean;
  isSaving: boolean;
}

@Component({
  selector: 'app-site-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './site-settings.component.html',
  styleUrl: './site-settings.component.css',
})
export class SiteSettingsComponent implements OnInit {
  settings$!: Observable<EditableSetting[]>;
  private refreshTrigger$ = new BehaviorSubject<void>(undefined);

  constructor(
    private adminService: AdminService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.settings$ = this.refreshTrigger$.pipe(
      switchMap(() => this.adminService.getSettings()),
      map(response => response.data.map(setting => ({
        ...setting,
        editValue: setting.value,
        isEditing: false,
        isSaving: false
      }))),
      catchError(error => {
        console.error('Failed to load settings:', error);
        this.toastService.error('Failed to load settings');
        return of([]);
      }),
      shareReplay(1)
    );
  }

  refreshSettings(): void {
    this.refreshTrigger$.next();
  }

  startEdit(setting: EditableSetting): void {
    setting.editValue = setting.value;
    setting.isEditing = true;
  }

  cancelEdit(setting: EditableSetting): void {
    setting.editValue = setting.value;
    setting.isEditing = false;
  }

  saveSetting(setting: EditableSetting): void {
    // Validate based on type
    if (!this.validateValue(setting.editValue, setting.valueType)) {
      this.toastService.error(this.getValidationError(setting.valueType));
      return;
    }

    setting.isSaving = true;
    this.adminService.updateSetting(setting.key, { value: setting.editValue }).subscribe({
      next: (response) => {
        setting.value = response.data.value;
        setting.isEditing = false;
        setting.isSaving = false;
        this.toastService.success('Setting updated successfully');
      },
      error: (error) => {
        console.error('Failed to update setting:', error);
        this.toastService.error(error.error?.message || 'Failed to update setting');
        setting.isSaving = false;
      }
    });
  }

  private validateValue(value: string, valueType: string): boolean {
    switch (valueType) {
      case 'number':
        return !isNaN(Number(value));
      case 'boolean':
        return value === 'true' || value === 'false';
      case 'json':
        try {
          JSON.parse(value);
          return true;
        } catch {
          return false;
        }
      default:
        return true;
    }
  }

  private getValidationError(valueType: string): string {
    switch (valueType) {
      case 'number':
        return 'Value must be a valid number';
      case 'boolean':
        return 'Value must be "true" or "false"';
      case 'json':
        return 'Value must be valid JSON';
      default:
        return 'Invalid value';
    }
  }

  formatSettingName(key: string): string {
    return key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, char => char.toUpperCase());
  }

  getInputType(valueType: string): string {
    switch (valueType) {
      case 'number':
        return 'number';
      case 'boolean':
        return 'select';
      case 'json':
        return 'textarea';
      default:
        return 'text';
    }
  }
}
