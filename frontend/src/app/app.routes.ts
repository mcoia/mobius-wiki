import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login';
import { WikiPageViewer } from './pages/wiki-page-viewer/wiki-page-viewer';
import { MainLayout } from './layout/main-layout/main-layout';
import { authGuard } from './core/guards/auth.guard';

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

  // Main app with layout
  {
    path: '',
    component: MainLayout,
    children: [
      // Wiki pages (3-level: /wiki/:wikiSlug/:sectionSlug/:pageSlug) - MUST BE FIRST
      {
        path: 'wiki/:wikiSlug/:sectionSlug/:pageSlug',
        component: WikiPageViewer
      },
      // Wiki pages (2-level: /wiki/:wikiSlug/:pageSlug) - MUST BE SECOND
      {
        path: 'wiki/:wikiSlug/:pageSlug',
        component: WikiPageViewer
      }
    ]
  }
];
