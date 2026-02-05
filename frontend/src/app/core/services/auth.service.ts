import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, map } from 'rxjs';
import { ApiService } from './api.service';
import { User, LoginRequest, AuthResponse } from '../models/user.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  public isGuest$ = this.currentUser$.pipe(map(user => user === null));

  private apiUrl = environment.apiUrl;

  constructor(
    private api: ApiService,
    private http: HttpClient
  ) {
    // Initialize by checking current session
    this.checkCurrentUser();
  }

  login(email: string, password: string): Observable<any> {
    const loginData: LoginRequest = { email, password };
    return this.api.post<any>('/auth/login', loginData).pipe(
      tap(response => {
        if (response.user) {
          this.currentUserSubject.next(response.user);
        }
      })
    );
  }

  logout(): Observable<any> {
    return this.api.post('/auth/logout', {}).pipe(
      tap(() => {
        this.currentUserSubject.next(null);
      })
    );
  }

  getCurrentUser(): Observable<any> {
    return this.api.get<any>('/auth/me');
  }

  checkCurrentUser(): void {
    this.getCurrentUser().subscribe({
      next: (response) => {
        // Backend returns { authenticated: true/false, user?: {...} }
        this.currentUserSubject.next(response.authenticated ? response.user : null);
      },
      error: () => {
        this.currentUserSubject.next(null);
      }
    });
  }

  get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  get isAuthenticated(): boolean {
    return this.currentUserValue !== null;
  }

  updateProfile(name?: string, email?: string): Observable<any> {
    const payload: { name?: string; email?: string } = {};
    if (name !== undefined) payload.name = name;
    if (email !== undefined) payload.email = email;

    return this.api.patch<any>('/auth/profile', payload).pipe(
      tap(response => {
        if (response.user) {
          this.currentUserSubject.next(response.user);
        }
      })
    );
  }

  changePassword(currentPassword: string, newPassword: string): Observable<any> {
    return this.api.post<any>('/auth/profile/change-password', {
      currentPassword,
      newPassword
    });
  }

  forgotPassword(email: string): Observable<any> {
    return this.api.post<any>('/auth/forgot-password', { email });
  }

  resetPassword(token: string, password: string): Observable<any> {
    return this.api.post<any>('/auth/reset-password', { token, password });
  }

  validateInvitationToken(token: string): Observable<any> {
    return this.api.get<any>(`/auth/invitation/${encodeURIComponent(token)}`);
  }

  acceptInvitation(token: string, password: string): Observable<any> {
    return this.api.post<any>('/auth/accept-invitation', { token, password });
  }

  uploadAvatar(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('avatar', file);

    return this.http.post<any>(`${this.apiUrl}/auth/profile/avatar`, formData, {
      withCredentials: true
    }).pipe(
      tap(response => {
        if (response.user) {
          this.currentUserSubject.next(response.user);
        }
      })
    );
  }

  removeAvatar(): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/auth/profile/avatar`, {
      withCredentials: true
    }).pipe(
      tap(response => {
        if (response.user) {
          this.currentUserSubject.next(response.user);
        }
      })
    );
  }

  setAvatarPreset(preset: string | null): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/auth/profile/avatar-preset`, { preset }, {
      withCredentials: true
    }).pipe(
      tap(response => {
        if (response.user) {
          this.currentUserSubject.next(response.user);
        }
      })
    );
  }
}
