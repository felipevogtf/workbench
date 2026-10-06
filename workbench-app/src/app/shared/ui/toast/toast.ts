import { Injectable, signal } from '@angular/core';

export type ToastTone = 'success' | 'danger' | 'info';

export interface ToastMessage {
  id: number;
  message: string;
  tone: ToastTone;
}

const DEFAULT_DURATION_MS = 4500;

@Injectable({ providedIn: 'root' })
export class Toast {
  private nextId = 1;
  private readonly items = signal<ToastMessage[]>([]);

  readonly messages = this.items.asReadonly();

  success(message: string): void {
    this.show(message, 'success');
  }

  error(message: string): void {
    this.show(message, 'danger');
  }

  info(message: string): void {
    this.show(message, 'info');
  }

  dismiss(id: number): void {
    this.items.update((list) => list.filter((toast) => toast.id !== id));
  }

  private show(message: string, tone: ToastTone): void {
    const id = this.nextId++;
    this.items.update((list) => [...list, { id, message, tone }]);
    setTimeout(() => this.dismiss(id), DEFAULT_DURATION_MS);
  }
}
