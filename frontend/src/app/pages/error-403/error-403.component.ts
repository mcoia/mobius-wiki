import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-error-403',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './error-403.component.html',
  styleUrls: ['./error-403.component.css']
})
export class Error403Component implements OnInit {
  returnUrl: string = '/';
  isAuthenticated$!: Observable<boolean>;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.isAuthenticated$ = this.authService.currentUser$.pipe(
      map(user => user !== null)
    );

    // Get returnUrl from query params
    this.route.queryParams.subscribe(params => {
      this.returnUrl = params['returnUrl'] || '/';
    });
  }

  goHome(): void {
    this.router.navigate(['/']);
  }

  goBack(): void {
    window.history.back();
  }

  login(): void {
    this.router.navigate(['/login'], {
      queryParams: { returnUrl: this.returnUrl }
    });
  }
}
