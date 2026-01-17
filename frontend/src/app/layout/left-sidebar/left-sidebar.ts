import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { Observable, Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
import { NavigationService } from '../../core/services/navigation.service';
import { NavTree } from '../../core/models/wiki.model';
import { LucideAngularModule, ChevronRight, ChevronDown } from 'lucide-angular';

@Component({
  selector: 'app-left-sidebar',
  imports: [CommonModule, RouterModule, LucideAngularModule],
  templateUrl: './left-sidebar.html',
  styleUrl: './left-sidebar.css',
})
export class LeftSidebar implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  currentUrl = '';
  navTree$!: Observable<NavTree | null>;
  expandedSections$!: Observable<Set<number>>;

  // Icons for template
  readonly ChevronRight = ChevronRight;
  readonly ChevronDown = ChevronDown;

  constructor(
    private router: Router,
    private navigationService: NavigationService
  ) {
    this.currentUrl = this.router.url;

    // Track route changes for active highlighting and auto-expand
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      takeUntil(this.destroy$)
    ).subscribe((event: NavigationEnd) => {
      this.currentUrl = event.url;
      this.handleRouteChange(event.url);
    });
  }

  ngOnInit(): void {
    // Get navigation tree observable
    this.navTree$ = this.navigationService.navTree$;
    this.expandedSections$ = this.navigationService.expandedSections$;

    // Load navigation data
    this.navigationService.loadNavigation().subscribe();

    // Auto-expand for initial route
    this.handleRouteChange(this.currentUrl);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Handle route changes - auto-expand section if on a page URL
   */
  private handleRouteChange(url: string): void {
    // Parse URL pattern: /wiki/:wikiSlug/:sectionSlug/:pageSlug
    const match = url.match(/^\/wiki\/([^\/]+)\/([^\/]+)\/([^\/]+)/);
    if (match) {
      const [, wikiSlug, sectionSlug] = match;
      this.navigationService.autoExpandForPage(wikiSlug, sectionSlug);
    }
  }

  /**
   * Toggle section expand/collapse
   */
  toggleSection(sectionId: number, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.navigationService.toggleSection(sectionId);
  }

  /**
   * Check if a section is expanded
   */
  isExpanded(sectionId: number): boolean {
    return this.navigationService.isExpanded(sectionId);
  }

  /**
   * Check if current URL is within a wiki
   */
  isWikiActive(wikiSlug: string): boolean {
    return this.currentUrl.startsWith(`/wiki/${wikiSlug}`);
  }

  /**
   * Check if current URL is within a section
   */
  isSectionActive(wikiSlug: string, sectionSlug: string): boolean {
    return this.currentUrl.startsWith(`/wiki/${wikiSlug}/${sectionSlug}`);
  }

  /**
   * Check if current URL matches a specific page
   */
  isPageActive(wikiSlug: string, sectionSlug: string, pageSlug: string): boolean {
    return this.currentUrl === `/wiki/${wikiSlug}/${sectionSlug}/${pageSlug}`;
  }
}
