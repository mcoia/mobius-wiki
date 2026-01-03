import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Observable } from 'rxjs';
import { PageContextService, PageEditState } from '../../core/services/page-context.service';

@Component({
  selector: 'app-header',
  imports: [CommonModule, RouterModule],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header implements OnInit {
  editState$!: Observable<PageEditState>;

  constructor(
    private pageContext: PageContextService
  ) {}

  ngOnInit(): void {
    this.editState$ = this.pageContext.editState$;
  }

  toggleEdit(): void {
    const currentState = this.pageContext.currentState;
    this.pageContext.updateEditState({
      isEditing: !currentState.isEditing
    });
  }

  saveContent(): void {
    // Trigger save event - WikiPageViewer will handle actual save
    this.pageContext.updateEditState({
      isSaving: true
    });
  }
}
