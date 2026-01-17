import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { take } from 'rxjs/operators';

export interface ConflictDialogConfig {
  lastModifiedBy: string;
  lastModifiedAt: string;
  currentVersion: number;
  expectedVersion: number;
}

export type ConflictDialogResult = 'view-changes' | 'save-anyway' | 'cancel';

interface DialogState extends ConflictDialogConfig {
  responseSubject: Subject<ConflictDialogResult>;
}

@Injectable({ providedIn: 'root' })
export class ConflictDialogService {
  private dialogSubject = new Subject<DialogState | null>();
  dialogConfig$ = this.dialogSubject.asObservable();

  private currentDialogState: DialogState | null = null;

  /**
   * Open a conflict dialog showing that the page was modified by another user.
   * Returns an observable that emits the user's choice.
   */
  open(config: ConflictDialogConfig): Observable<ConflictDialogResult> {
    const responseSubject = new Subject<ConflictDialogResult>();
    const dialogState: DialogState = {
      ...config,
      responseSubject
    };

    this.currentDialogState = dialogState;
    this.dialogSubject.next(dialogState);

    return responseSubject.asObservable().pipe(take(1));
  }

  /**
   * Close the dialog with the specified result.
   */
  close(result: ConflictDialogResult): void {
    if (this.currentDialogState) {
      this.currentDialogState.responseSubject.next(result);
      this.currentDialogState.responseSubject.complete();
      this.currentDialogState = null;
      this.dialogSubject.next(null);
    }
  }
}
