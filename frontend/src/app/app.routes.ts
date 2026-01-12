import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login';
import { WikiPageViewer } from './pages/wiki-page-viewer/wiki-page-viewer';
import { WikiListComponent } from './pages/wiki-list/wiki-list';
import { WikiCreateComponent } from './pages/wiki-create/wiki-create.component';
import { WikiDetailComponent } from './pages/wiki-detail/wiki-detail.component';
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
      // Wiki routes - ORDER MATTERS!
      // Literal paths must come before dynamic paths
      {
        path: 'wiki',
        component: WikiListComponent  // Browse all wikis
      },
      {
        path: 'wiki/new',
        component: WikiCreateComponent  // Create new wiki
      },
      // Dynamic paths - most specific first
      {
        path: 'wiki/:wikiSlug/:sectionSlug/:pageSlug',
        component: WikiPageViewer  // View specific page (3-level)
      },
      {
        path: 'wiki/site',
        pathMatch: 'full',
        redirectTo: '/wiki/site/main/home'
      },
      {
        path: 'wiki/:wikiSlug',
        component: WikiDetailComponent  // Wiki overview
      }
    ]
  }
];
