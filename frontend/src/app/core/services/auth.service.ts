import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { ApiService } from './api.service';
import { User, LoginRequest, AuthResponse } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private api: ApiService) {
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
}
