import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `danger` pinta el botón de confirmar como destructivo. */
  tone?: 'primary' | 'danger';
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (confirmed: boolean) => void;
}

/** `await confirmDialog.ask({...})` abre un diálogo (renderizado por `ConfirmHost`) y devuelve la decisión. */
@Injectable({ providedIn: 'root' })
export class ConfirmDialog {
  private readonly pending = signal<PendingConfirm | null>(null);

  readonly request = this.pending.asReadonly();

  ask(options: ConfirmOptions): Promise<boolean> {
    // Si ya había una pregunta abierta, se cancela.
    this.pending()?.resolve(false);
    return new Promise<boolean>((resolve) => this.pending.set({ ...options, resolve }));
  }

  answer(confirmed: boolean): void {
    const current = this.pending();
    if (!current) return;
    this.pending.set(null);
    current.resolve(confirmed);
  }
}
