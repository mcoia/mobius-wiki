import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { WikiService } from '../../core/services/wiki.service';
import { Wiki } from '../../core/models/wiki.model';

@Component({
  selector: 'app-left-sidebar',
  imports: [CommonModule, RouterModule],
  templateUrl: './left-sidebar.html',
  styleUrl: './left-sidebar.css',
})
export class LeftSidebar implements OnInit {
  currentUrl = '';
  wikis: Wiki[] = [];
  loading = true;

  constructor(
    private router: Router,
    private wikiService: WikiService
  ) {
    this.currentUrl = this.router.url;

    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.currentUrl = event.url;
    });
  }

  ngOnInit(): void {
    this.loadWikis();
  }

  loadWikis(): void {
    this.wikiService.getWikis().subscribe({
      next: (response) => {
        this.wikis = response.data;
        this.loading = false;
      },
      error: (error) => {
        console.error('Failed to load wikis for navigation:', error);
        this.loading = false;
      }
    });
  }

  isActive(url: string): boolean {
    return this.currentUrl === url;
  }

  isWikiActive(wikiSlug: string): boolean {
    return this.currentUrl.includes(`/wiki/${wikiSlug}`);
  }
}
