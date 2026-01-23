import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import {
  LibraryStaffUser,
  CreateLibraryStaffRequest,
  UpdateLibraryStaffRequest,
  Library,
  CreateLibraryRequest,
  UpdateLibraryRequest,
  AccessRule
} from '../models/staff.model';

@Injectable({
  providedIn: 'root'
})
export class StaffService {
  constructor(private api: ApiService) {}

  // Library Staff Users
  getLibraryStaffUsers(): Observable<{ data: LibraryStaffUser[]; meta: { total: number } }> {
    return this.api.get('/staff/users');
  }

  getLibraryStaffUser(id: number): Observable<{ data: LibraryStaffUser }> {
    return this.api.get(`/staff/users/${id}`);
  }

  createLibraryStaffUser(data: CreateLibraryStaffRequest): Observable<{ data: LibraryStaffUser }> {
    return this.api.post('/staff/users', data);
  }

  updateLibraryStaffUser(id: number, data: UpdateLibraryStaffRequest): Observable<{ data: LibraryStaffUser }> {
    return this.api.patch(`/staff/users/${id}`, data);
  }

  deleteLibraryStaffUser(id: number): Observable<{ data: LibraryStaffUser }> {
    return this.api.delete(`/staff/users/${id}`);
  }

  activateLibraryStaffUser(id: number): Observable<{ data: LibraryStaffUser }> {
    return this.api.post(`/staff/users/${id}/activate`, {});
  }

  deactivateLibraryStaffUser(id: number): Observable<{ data: LibraryStaffUser }> {
    return this.api.post(`/staff/users/${id}/deactivate`, {});
  }

  resetLibraryStaffPassword(id: number, password: string): Observable<{ success: boolean }> {
    return this.api.post(`/staff/users/${id}/reset-password`, { password });
  }

  sendPasswordResetEmail(id: number): Observable<{ success: boolean; message: string }> {
    return this.api.post(`/staff/users/${id}/send-password-reset`, {});
  }

  // Libraries
  getLibraries(): Observable<{ data: Library[]; meta: { total: number } }> {
    return this.api.get('/staff/libraries');
  }

  getLibrary(id: number): Observable<{ data: Library }> {
    return this.api.get(`/staff/libraries/${id}`);
  }

  createLibrary(data: CreateLibraryRequest): Observable<{ data: Library }> {
    return this.api.post('/staff/libraries', data);
  }

  updateLibrary(id: number, data: UpdateLibraryRequest): Observable<{ data: Library }> {
    return this.api.patch(`/staff/libraries/${id}`, data);
  }

  deleteLibrary(id: number): Observable<{ data: Library }> {
    return this.api.delete(`/staff/libraries/${id}`);
  }

  // Access Rules
  getAccessRules(filters?: { ruleableType?: string; ruleType?: string }): Observable<{ data: AccessRule[]; meta: { total: number } }> {
    const params = new URLSearchParams();
    if (filters?.ruleableType) params.append('ruleableType', filters.ruleableType);
    if (filters?.ruleType) params.append('ruleType', filters.ruleType);
    const queryString = params.toString();
    return this.api.get(`/staff/access-rules${queryString ? `?${queryString}` : ''}`);
  }

  getAccessRule(id: number): Observable<{ data: AccessRule }> {
    return this.api.get(`/staff/access-rules/${id}`);
  }

  deleteAccessRule(id: number): Observable<{ data: AccessRule }> {
    return this.api.delete(`/staff/access-rules/${id}`);
  }
}
