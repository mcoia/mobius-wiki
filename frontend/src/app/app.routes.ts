import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login';
import { ForgotPasswordComponent } from './pages/forgot-password/forgot-password.component';
import { ResetPasswordComponent } from './pages/reset-password/reset-password.component';
import { SetPasswordComponent } from './pages/set-password/set-password.component';
import { WikiPageViewer } from './pages/wiki-page-viewer/wiki-page-viewer';
import { WikiListComponent } from './pages/wiki-list/wiki-list';
import { WikiCreateComponent } from './pages/wiki-create/wiki-create.component';
import { WikiDetailComponent } from './pages/wiki-detail/wiki-detail.component';
import { SectionDetailComponent } from './pages/wiki/section-detail/section-detail.component';
import { AdminComponent } from './pages/admin/admin.component';
import { StaffComponent } from './pages/staff/staff.component';
import { ProfileComponent } from './pages/profile/profile.component';
import { SearchComponent } from './pages/search/search.component';
import { MainLayout } from './layout/main-layout/main-layout';
import { Error404Component } from './pages/error-404/error-404.component';
import { Error403Component } from './pages/error-403/error-403.component';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';
import { staffGuard } from './core/guards/staff.guard';
import { optionalAuthGuard } from './core/guards/optional-auth.guard';

export const routes: Routes = [
  // Root redirects to site wiki home
  {
    path: '',
    pathMatch: 'full',
    redirectTo: '/wiki/site/main/home'
  },

  // Login page (no layout)
  {
    path: 'login',
    component: LoginComponent
  },

  // Password reset pages (no layout)
  {
    path: 'forgot-password',
    component: ForgotPasswordComponent
  },
  {
    path: 'reset-password',
    component: ResetPasswordComponent
  },
  {
    path: 'set-password',
    component: SetPasswordComponent
  },

  // Main app with layout (public by default)
  {
    path: '',
    component: MainLayout,
    canActivate: [optionalAuthGuard],  // Check auth but don't block guests
    children: [
      // Admin panel (site_admin only)
      {
        path: 'admin',
        component: AdminComponent,
        canActivate: [authGuard, adminGuard]
      },
      // Staff panel (mobius_staff and site_admin)
      {
        path: 'staff',
        component: StaffComponent,
        canActivate: [authGuard, staffGuard]
      },
      // User profile (any authenticated user)
      {
        path: 'profile',
        component: ProfileComponent,
        canActivate: [authGuard]
      },
      // Search results page (public)
      {
        path: 'search',
        component: SearchComponent
      },
      // Wiki routes - ORDER MATTERS!
      // Literal paths must come before dynamic paths
      {
        path: 'wiki',
        component: WikiListComponent  // Browse all wikis (public)
      },
      {
        path: 'wiki/new',
        component: WikiCreateComponent,  // Create new wiki (requires auth)
        canActivate: [authGuard]
      },
      // Dynamic paths - most specific first
      {
        path: 'wiki/:wikiSlug/:sectionSlug/:pageSlug',
        component: WikiPageViewer  // View specific page (public, ACL enforced by backend)
      },
      {
        path: 'wiki/:wikiSlug/:sectionSlug',
        component: SectionDetailComponent  // Section overview (public)
      },
      {
        path: 'wiki/:wikiSlug',
        component: WikiDetailComponent  // Wiki overview (public)
      }
    ]
  },

  // Error pages (no auth required)
  {
    path: '403',
    component: Error403Component
  },
  {
    path: '404',
    component: Error404Component
  },

  // Wildcard route - must be last
  {
    path: '**',
    redirectTo: '/404'
  }
];
