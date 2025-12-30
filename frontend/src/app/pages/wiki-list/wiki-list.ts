import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, catchError, shareReplay } from 'rxjs/operators';
import { WikiService } from '../../core/services/wiki.service';
import { Wiki } from '../../core/models/wiki.model';

@Component({
  selector: 'app-wiki-list',
  imports: [CommonModule, RouterModule],
  templateUrl: './wiki-list.html',
  styleUrl: './wiki-list.css'
})
export class WikiListComponent implements OnInit {
  wikis$!: Observable<Wiki[]>;
  error: string | null = null;

  constructor(private wikiService: WikiService) {}

  ngOnInit(): void {
    this.wikis$ = this.wikiService.getWikis().pipe(
      map(response => response.data),
      catchError(error => {
        console.error('Failed to load wikis:', error);
        this.error = 'Failed to load wikis. Please try again later.';
        return of([]);
      }),
      shareReplay(1) // Cache the result to avoid multiple HTTP calls
    );
  }
}
