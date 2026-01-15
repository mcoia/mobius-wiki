import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface ToastConfig {
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

export interface Toast extends ToastConfig {
  id: number;
  visible: boolean;
  duration: number;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private toastsSubject = new BehaviorSubject<Toast[]>([]);
  toasts$: Observable<Toast[]> = this.toastsSubject.asObservable();
  private idCounter = 0;
  private readonly MAX_TOASTS = 5;

  show(config: ToastConfig) {
    const toast: Toast = {
      ...config,
      id: ++this.idCounter,
      visible: true,
      duration: config.duration || 4000
    };

    let current = this.toastsSubject.value;

    // Limit to MAX_TOASTS - remove oldest if needed
    if (current.length >= this.MAX_TOASTS) {
      current = current.slice(-(this.MAX_TOASTS - 1));
    }

    this.toastsSubject.next([...current, toast]);

    // Auto-dismiss after duration
    setTimeout(() => this.dismiss(toast.id), toast.duration);
  }

  success(message: string, duration?: number) {
    this.show({ message, type: 'success', duration });
  }

  error(message: string, duration?: number) {
    this.show({ message, type: 'error', duration });
  }

  warning(message: string, duration?: number) {
    this.show({ message, type: 'warning', duration });
  }

  info(message: string, duration?: number) {
    this.show({ message, type: 'info', duration });
  }

  dismiss(id: number) {
    const current = this.toastsSubject.value;
    this.toastsSubject.next(current.filter(t => t.id !== id));
  }
}
