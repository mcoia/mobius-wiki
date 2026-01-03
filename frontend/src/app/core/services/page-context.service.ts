import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface PageEditState {
  isEditing: boolean;
  canEdit: boolean;
  currentPageId: number | null;
  isSaving: boolean;
  saveError: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class PageContextService {
  private editStateSubject = new BehaviorSubject<PageEditState>({
    isEditing: false,
    canEdit: false,
    currentPageId: null,
    isSaving: false,
    saveError: null
  });

  public editState$ = this.editStateSubject.asObservable();

  updateEditState(state: Partial<PageEditState>): void {
    this.editStateSubject.next({
      ...this.editStateSubject.value,
      ...state
    });
  }

  resetEditState(): void {
    this.editStateSubject.next({
      isEditing: false,
      canEdit: false,
      currentPageId: null,
      isSaving: false,
      saveError: null
    });
  }

  get currentState(): PageEditState {
    return this.editStateSubject.value;
  }
}
