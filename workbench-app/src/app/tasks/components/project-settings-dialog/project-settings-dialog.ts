import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  model,
  signal,
  untracked,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { errorMessage } from '@core/api/api-error';
import { Alert } from '@shared/ui/alert/alert';
import { Button } from '@shared/ui/button/button';
import { Checkbox } from '@shared/ui/checkbox/checkbox';
import { Dialog } from '@shared/ui/dialog/dialog';
import { ProjectsStore } from '../../data-access/projects.store';
import { Project } from '../../models/catalogs';

/**
 * Opciones de un proyecto: si se sincroniza con Plane (solo los de Plane) y si es visible. Un
 * proyecto oculto no aparece en ningún selector ni listado, ni sus tareas.
 */
@Component({
  selector: 'app-project-settings-dialog',
  imports: [ReactiveFormsModule, Dialog, Checkbox, Button, Alert],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog [heading]="'Configurar ' + (project()?.name ?? '')" [(open)]="open">
      <form id="project-settings-form" class="stack" [formGroup]="form" (ngSubmit)="submit()">
        @if (error(); as message) {
          <app-alert tone="danger" heading="No se pudo guardar">{{ message }}</app-alert>
        }
        @if (project()?.source) {
          <app-checkbox formControlName="syncEnabled">
            Sincronizar con Plane
            <span class="hint"
              >El sync (cada hora y el botón) trae las tareas de este proyecto.</span
            >
          </app-checkbox>
        }
        <app-checkbox formControlName="visible">
          Visible
          <span class="hint"
            >Si no está visible, el proyecto y sus tareas no aparecen en selectores ni
            listados.</span
          >
        </app-checkbox>
      </form>

      <ng-container dialog-footer>
        <button app-button variant="secondary" type="button" (click)="open.set(false)">
          Cancelar
        </button>
        <button app-button type="submit" form="project-settings-form" [loading]="saving()">
          Guardar
        </button>
      </ng-container>
    </app-dialog>
  `,
  styles: `
    .hint {
      display: block;
      font-size: 0.8125rem;
      color: var(--text-color);
    }
  `,
})
export class ProjectSettingsDialog {
  readonly open = model(false);
  readonly project = input.required<Project | null>();

  private readonly store = inject(ProjectsStore);

  protected readonly form = inject(NonNullableFormBuilder).group({
    syncEnabled: true,
    visible: true,
  });
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    // Cada vez que se abre, el formulario parte de los valores del proyecto.
    effect(() => {
      const project = this.project();
      if (!this.open() || !project) return;
      untracked(() => {
        this.form.reset({ syncEnabled: project.syncEnabled, visible: project.visible });
        this.error.set(null);
      });
    });
  }

  protected async submit(): Promise<void> {
    const project = this.project();
    if (!project) return;

    const { syncEnabled, visible } = this.form.getRawValue();
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.store.configure(project.id, {
        visible,
        ...(project.source ? { syncEnabled } : {}),
      });
      this.open.set(false);
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }
}
