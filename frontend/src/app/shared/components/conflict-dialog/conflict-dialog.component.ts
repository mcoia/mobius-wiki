import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConflictDialogService, ConflictDialogConfig } from '../../../core/services/conflict-dialog.service';

@Component({
  selector: 'app-conflict-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './conflict-dialog.component.html',
  styleUrls: ['./conflict-dialog.component.css']
})
export class ConflictDialogComponent implements OnInit {
  config: ConflictDialogConfig | null = null;

  constructor(private dialogService: ConflictDialogService) {}

  ngOnInit(): void {
    this.dialogService.dialogConfig$.subscribe((dialogState: any) => {
      this.config = dialogState;
    });
  }

  formatDate(dateString: string): string {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleString();
  }

  onViewChanges(): void {
    this.dialogService.close('view-changes');
  }

  onSaveAnyway(): void {
    this.dialogService.close('save-anyway');
  }

  onCancel(): void {
    this.dialogService.close('cancel');
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.onCancel();
  }
}
