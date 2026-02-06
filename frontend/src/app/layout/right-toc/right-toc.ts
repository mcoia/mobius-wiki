import { Component, OnInit, HostBinding, DestroyRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { LucideAngularModule, PanelRightClose, PanelRightOpen } from 'lucide-angular';
import { TocService, TocItem } from '../../core/services/toc.service';

@Component({
  selector: 'app-right-toc',
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './right-toc.html',
  styleUrl: './right-toc.css',
})
export class RightToc implements OnInit {
  private destroyRef = inject(DestroyRef);

  headings$!: Observable<TocItem[]>;
  activeId$!: Observable<string | null>;
  isCollapsed$!: Observable<boolean>;
  hasHeadings = false;

  // Lucide icons
  readonly PanelRightClose = PanelRightClose;
  readonly PanelRightOpen = PanelRightOpen;

  @HostBinding('class.has-content')
  get showSidebar(): boolean {
    return this.hasHeadings;
  }

  @HostBinding('class.collapsed')
  get isCollapsedClass(): boolean {
    return this.tocService.isCollapsed;
  }

  constructor(private tocService: TocService) {}

  ngOnInit(): void {
    // Subscribe directly to track headings (independent of template)
    // This ensures hasHeadings is always set correctly, even when collapsed
    this.tocService.headings$.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(headings => {
      this.hasHeadings = headings.length > 0;
    });

    // Template observables
    this.headings$ = this.tocService.headings$;
    this.activeId$ = this.tocService.activeId$;
    this.isCollapsed$ = this.tocService.isCollapsed$;
  }

  /**
   * Toggle collapsed state
   */
  toggleCollapse(): void {
    this.tocService.toggleCollapse();
  }

  /**
   * Smooth scroll to a heading
   */
  scrollTo(id: string, event: Event): void {
    event.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}
