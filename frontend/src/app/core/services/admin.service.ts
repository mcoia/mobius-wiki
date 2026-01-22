import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { StaffUser, CreateStaffUserRequest, UpdateStaffUserRequest, Setting, UpdateSettingRequest } from '../models/admin.model';

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  constructor(private api: ApiService) {}

  // Staff Users
  getStaffUsers(): Observable<{ data: StaffUser[]; meta: { total: number } }> {
    return this.api.get('/admin/users');
  }

  getStaffUser(id: number): Observable<{ data: StaffUser }> {
    return this.api.get(`/admin/users/${id}`);
  }

  createStaffUser(data: CreateStaffUserRequest): Observable<{ data: StaffUser }> {
    return this.api.post('/admin/users', data);
  }

  updateStaffUser(id: number, data: UpdateStaffUserRequest): Observable<{ data: StaffUser }> {
    return this.api.patch(`/admin/users/${id}`, data);
  }

  deleteStaffUser(id: number): Observable<{ data: StaffUser }> {
    return this.api.delete(`/admin/users/${id}`);
  }

  activateStaffUser(id: number): Observable<{ data: StaffUser }> {
    return this.api.post(`/admin/users/${id}/activate`, {});
  }

  deactivateStaffUser(id: number): Observable<{ data: StaffUser }> {
    return this.api.post(`/admin/users/${id}/deactivate`, {});
  }

  resetPassword(id: number, password: string): Observable<{ success: boolean }> {
    return this.api.post(`/admin/users/${id}/reset-password`, { password });
  }

  // Settings
  getSettings(): Observable<{ data: Setting[]; meta: { total: number } }> {
    return this.api.get('/admin/settings');
  }

  getSetting(key: string): Observable<{ data: Setting }> {
    return this.api.get(`/admin/settings/${key}`);
  }

  updateSetting(key: string, data: UpdateSettingRequest): Observable<{ data: Setting }> {
    return this.api.patch(`/admin/settings/${key}`, data);
  }
}
