import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfirmDialogService, ConfirmDialogConfig } from '../../../core/services/confirm-dialog.service';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './confirm-dialog.component.html',
  styleUrls: ['./confirm-dialog.component.css']
})
export class ConfirmDialogComponent implements OnInit {
  config: (ConfirmDialogConfig & { confirmText: string; cancelText: string; type: string }) | null = null;

  constructor(private dialogService: ConfirmDialogService) {}

  ngOnInit() {
    this.dialogService.dialogConfig$.subscribe((dialogState: any) => {
      this.config = dialogState;
    });
  }

  getIcon(type: string): string {
    const icons: { [key: string]: string } = {
      warning: '⚠️',
      danger: '❌',
      info: 'ℹ️',
      success: '✅'
    };
    return icons[type] || 'ℹ️';
  }

  onConfirm() {
    this.dialogService.close(true);
  }

  onCancel() {
    this.dialogService.close(false);
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.onCancel();
  }
}
