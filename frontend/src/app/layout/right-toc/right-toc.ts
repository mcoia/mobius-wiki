import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { TocService, TocItem } from '../../core/services/toc.service';

@Component({
  selector: 'app-right-toc',
  imports: [CommonModule],
  templateUrl: './right-toc.html',
  styleUrl: './right-toc.css',
})
export class RightToc implements OnInit {
  headings$!: Observable<TocItem[]>;
  activeId$!: Observable<string | null>;

  constructor(private tocService: TocService) {}

  ngOnInit(): void {
    this.headings$ = this.tocService.headings$;
    this.activeId$ = this.tocService.activeId$;
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
