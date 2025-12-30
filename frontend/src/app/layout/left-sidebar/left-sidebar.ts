import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { Observable, of } from 'rxjs';
import { filter, map, catchError, shareReplay } from 'rxjs/operators';
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
  wikis$!: Observable<Wiki[]>;

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
    this.wikis$ = this.wikiService.getWikis().pipe(
      map(response => response.data),
      catchError(error => {
        console.error('Failed to load wikis for navigation:', error);
        return of([]);
      }),
      shareReplay(1)
    );
  }

  isActive(url: string): boolean {
    return this.currentUrl === url;
  }

  isWikiActive(wikiSlug: string): boolean {
    return this.currentUrl.includes(`/wiki/${wikiSlug}`);
  }
}
