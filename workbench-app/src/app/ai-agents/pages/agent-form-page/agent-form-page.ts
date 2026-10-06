import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { errorMessage } from '@core/api/api-error';
import { Alert } from '@shared/ui/alert/alert';
import { Button } from '@shared/ui/button/button';
import { FormField } from '@shared/ui/form-field/form-field';
import { Icon } from '@shared/ui/icon/icon';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { Skeleton } from '@shared/ui/skeleton/skeleton';
import { TextInput } from '@shared/ui/text-input/text-input';
import { Textarea } from '@shared/ui/textarea/textarea';
import { Toast } from '@shared/ui/toast/toast';
import { ToolsPicker } from '../../components/tools-picker/tools-picker';
import { AgentsStore } from '../../data-access/agents.store';
import { ALLOWED_AGENT_TOOLS, MODEL_SUGGESTIONS } from '../../models/agent';

/** Crea (`/agents/new`) o edita (`/agents/:id/edit`) un agente. */
@Component({
  selector: 'app-agent-form-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    PageHeader,
    FormField,
    TextInput,
    Textarea,
    ToolsPicker,
    Button,
    Icon,
    Alert,
    Skeleton,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './agent-form-page.html',
  styleUrl: './agent-form-page.scss',
})
export class AgentFormPage {
  /** Viene de la ruta (`withComponentInputBinding`); vacío al crear. */
  readonly id = input<string>();

  private readonly store = inject(AgentsStore);
  private readonly router = inject(Router);
  private readonly toast = inject(Toast);

  protected readonly modelSuggestions = MODEL_SUGGESTIONS;
  protected readonly toolOptions = ALLOWED_AGENT_TOOLS;

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    model: ['', Validators.required],
    systemPrompt: ['', Validators.required],
  });
  protected readonly tools = signal<string[]>([...ALLOWED_AGENT_TOOLS]);

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly isEdit = computed(() => !!this.id());

  constructor() {
    effect(() => {
      const id = this.id();
      if (id) untracked(() => void this.load(id));
    });
  }

  protected fieldError(name: 'name' | 'model' | 'systemPrompt'): string | null {
    const control = this.form.controls[name];
    return control.touched && control.invalid ? 'Este campo es obligatorio' : null;
  }

  protected async submit(): Promise<void> {
    this.error.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = { ...this.form.getRawValue(), allowedTools: this.tools() };
    this.saving.set(true);
    try {
      const id = this.id();
      if (id) {
        await this.store.update(id, value);
        this.toast.success('Agente actualizado');
      } else {
        await this.store.create(value);
        this.toast.success('Agente creado');
      }
      await this.router.navigate(['/agents']);
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }

  private async load(id: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const agent = await this.store.find(id);
      this.form.patchValue({
        name: agent.name,
        model: agent.model,
        systemPrompt: agent.systemPrompt,
      });
      this.tools.set([...agent.allowedTools]);
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }
}
