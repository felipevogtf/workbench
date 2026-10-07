import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  untracked,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import type { Agent } from '@ai-agents/index';
import { ProvidersStore } from '@ai-agents/index';
import { toSignal } from '@angular/core/rxjs-interop';
import { Button } from '@shared/ui/button/button';
import { Dialog } from '@shared/ui/dialog/dialog';
import { FormField } from '@shared/ui/form-field/form-field';
import { Select, SelectOption } from '@shared/ui/select/select';
import { TextInput } from '@shared/ui/text-input/text-input';
import { ReReviewRequest } from '../../models/pull-request';

/** Pide con qué agente y modelo re-revisar. Vacío = el agente y el modelo por defecto. */
@Component({
  selector: 'app-re-review-dialog',
  imports: [ReactiveFormsModule, Dialog, Button, FormField, Select, TextInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog heading="Re-revisar pull request" [(open)]="open">
      <form id="re-review-form" class="form" [formGroup]="form" (ngSubmit)="confirm()">
        <p class="intro break-anywhere">
          «{{ title() }}» volverá a la cola de revisión. Puedes elegir otro agente o modelo solo
          para esta vez.
        </p>

        <app-form-field label="Agente" for="rr-agent">
          <app-select
            inputId="rr-agent"
            formControlName="agentId"
            [options]="agentOptions()"
            [placeholder]="defaultLabel()"
          />
        </app-form-field>

        <app-form-field label="Modelo" for="rr-model" hint="Vacío usa el modelo del agente.">
          <app-text-input
            inputId="rr-model"
            formControlName="model"
            placeholder="claude-opus-5-5"
            [suggestions]="modelSuggestions()"
            describedBy="rr-model-msg"
          />
        </app-form-field>
      </form>

      <ng-container dialog-footer>
        <button app-button variant="secondary" type="button" (click)="open.set(false)">
          Cancelar
        </button>
        <button app-button type="submit" form="re-review-form">Re-revisar</button>
      </ng-container>
    </app-dialog>
  `,
  styles: `
    .form {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }

    .intro {
      margin: 0;
    }
  `,
})
export class ReReviewDialog {
  readonly open = model(false);
  readonly title = input.required<string>();
  readonly agents = input.required<readonly Agent[]>();

  readonly confirmed = output<ReReviewRequest>();

  private readonly providers = inject(ProvidersStore);
  protected readonly form = inject(NonNullableFormBuilder).group({ agentId: [''], model: [''] });
  private readonly selectedAgentId = toSignal(this.form.controls.agentId.valueChanges, {
    initialValue: '',
  });

  /** Modelos del proveedor del agente elegido (o del agente por defecto). */
  protected readonly modelSuggestions = computed(() => {
    const agents = this.agents();
    const agent =
      agents.find((candidate) => candidate.id === this.selectedAgentId()) ??
      agents.find((candidate) => candidate.isDefault);
    return this.providers.modelsOf(agent?.provider);
  });

  protected readonly agentOptions = computed<SelectOption[]>(() =>
    this.agents().map((agent) => ({
      value: agent.id,
      label: agent.isDefault ? `${agent.name} (por defecto)` : agent.name,
    })),
  );

  protected readonly defaultLabel = computed(() => {
    const defaultAgent = this.agents().find((agent) => agent.isDefault);
    return defaultAgent ? `Por defecto: ${defaultAgent.name}` : 'Agente por defecto';
  });

  constructor() {
    void this.providers.load();
    // Cada vez que se abre, el formulario parte limpio.
    effect(() => {
      if (this.open()) untracked(() => this.form.reset());
    });
  }

  protected confirm(): void {
    const { agentId, model } = this.form.getRawValue();
    this.confirmed.emit({
      agentId: agentId || undefined,
      model: model.trim() || undefined,
    });
    this.open.set(false);
  }
}
