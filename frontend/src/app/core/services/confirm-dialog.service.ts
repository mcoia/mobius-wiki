import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { take } from 'rxjs/operators';

export interface ConfirmDialogConfig {
  title: string;
  message: string;
  type?: 'warning' | 'danger' | 'info' | 'success';
  confirmText?: string;
  cancelText?: string;
}

interface DialogState extends ConfirmDialogConfig {
  responseSubject: Subject<boolean>;
}

@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  private dialogSubject = new Subject<DialogState | null>();
  dialogConfig$ = this.dialogSubject.asObservable();

  private currentDialogState: DialogState | null = null;

  open(config: ConfirmDialogConfig): Observable<boolean> {
    const responseSubject = new Subject<boolean>();
    const dialogState: DialogState = {
      ...config,
      type: config.type || 'info',
      confirmText: config.confirmText || 'Confirm',
      cancelText: config.cancelText || 'Cancel',
      responseSubject
    };

    this.currentDialogState = dialogState;
    this.dialogSubject.next(dialogState);

    return responseSubject.asObservable().pipe(take(1));
  }

  close(confirmed: boolean) {
    if (this.currentDialogState) {
      this.currentDialogState.responseSubject.next(confirmed);
      this.currentDialogState.responseSubject.complete();
      this.currentDialogState = null;
      this.dialogSubject.next(null);
    }
  }
}
