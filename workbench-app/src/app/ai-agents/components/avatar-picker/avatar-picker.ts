import { ChangeDetectionStrategy, Component, inject, input, model, signal } from '@angular/core';
import { Avatar } from '@shared/ui/avatar/avatar';
import { Button } from '@shared/ui/button/button';
import { AVATAR_RESIZER } from './resize-image';

/**
 * Elige la imagen de un trabajador: cualquier foto, que se recorta al cuadrado y se reduce sola.
 * `value` es la imagen (data URL) o `null` para usar el avatar dibujado.
 */
@Component({
  selector: 'app-avatar-picker',
  imports: [Avatar, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="picker">
      <app-avatar [name]="name() || '?'" [src]="value()" size="4rem" />
      <div class="actions">
        <button app-button type="button" variant="secondary" size="sm" (click)="file.click()">
          {{ value() ? 'Cambiar imagen' : 'Subir imagen' }}
        </button>
        @if (value()) {
          <button app-button type="button" variant="ghost" size="sm" (click)="value.set(null)">
            Quitar
          </button>
        }
      </div>
      <input
        #file
        id="agent-avatar"
        class="file"
        type="file"
        accept="image/*"
        aria-label="Imagen del trabajador"
        (change)="pick(file)"
      />
    </div>
    @if (error(); as message) {
      <p class="error" role="alert">{{ message }}</p>
    }
  `,
  styles: `
    .picker {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .actions {
      display: flex;
      gap: 0.5rem;
    }

    .file {
      display: none;
    }

    .error {
      margin: 0.5rem 0 0;
      font-size: 0.875rem;
      color: var(--color-danger, #f87171);
    }
  `,
})
export class AvatarPicker {
  /** Nombre del trabajador: da la inicial y el color mientras no hay imagen. */
  readonly name = input('');
  readonly value = model<string | null>(null);

  private readonly resize = inject(AVATAR_RESIZER);
  protected readonly error = signal<string | null>(null);

  protected async pick(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    this.error.set(null);
    if (!file.type.startsWith('image/')) {
      this.error.set('El archivo no es una imagen');
      return;
    }
    try {
      this.value.set(await this.resize(file));
    } catch {
      this.error.set('No se pudo leer la imagen');
    }
  }
}
