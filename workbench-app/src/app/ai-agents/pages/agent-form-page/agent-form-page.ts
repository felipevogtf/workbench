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
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { errorMessage } from '@core/api/api-error';
import { Alert } from '@shared/ui/alert/alert';
import { Button } from '@shared/ui/button/button';
import { FormField } from '@shared/ui/form-field/form-field';
import { Icon } from '@shared/ui/icon/icon';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { Select, SelectOption } from '@shared/ui/select/select';
import { Skeleton } from '@shared/ui/skeleton/skeleton';
import { TextInput } from '@shared/ui/text-input/text-input';
import { Textarea } from '@shared/ui/textarea/textarea';
import { Toast } from '@shared/ui/toast/toast';
import { ToolsPicker } from '../../components/tools-picker/tools-picker';
import { AgentsStore } from '../../data-access/agents.store';
import { ProvidersStore } from '../../data-access/providers.store';
import { ALLOWED_AGENT_TOOLS, AgentProvider } from '../../models/agent';

type RequiredField = 'name' | 'provider' | 'model' | 'systemPrompt';

/** Crea (`/agents/new`) o edita (`/agents/:id/edit`) un agente. */
@Component({
  selector: 'app-agent-form-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    PageHeader,
    FormField,
    TextInput,
    Select,
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
  private readonly providersStore = inject(ProvidersStore);
  private readonly router = inject(Router);
  private readonly toast = inject(Toast);

  protected readonly toolOptions = ALLOWED_AGENT_TOOLS;

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    provider: ['claude', Validators.required],
    model: ['', Validators.required],
    systemPrompt: ['', Validators.required],
  });
  protected readonly tools = signal<string[]>([...ALLOWED_AGENT_TOOLS]);

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly isEdit = computed(() => !!this.id());

  private readonly provider = toSignal(this.form.controls.provider.valueChanges, {
    initialValue: this.form.controls.provider.value,
  });
  private readonly model = toSignal(this.form.controls.model.valueChanges, {
    initialValue: this.form.controls.model.value,
  });
  /** Proveedor con el que se guardó el agente que se edita (sigue disponible aunque se deshabilite). */
  private readonly savedProvider = signal<AgentProvider | null>(null);

  /** Solo los habilitados, más el actual del agente (para no perderlo al editar). */
  protected readonly providerOptions = computed<SelectOption[]>(() =>
    this.providersStore
      .providers()
      .filter((provider) => provider.enabled || provider.id === this.savedProvider())
      .map((provider) => ({
        value: provider.id,
        label: provider.enabled ? provider.label : `${provider.label} (deshabilitado)`,
      })),
  );

  /** Modelos del proveedor elegido; si el agente tiene uno que no está en la lista, se conserva. */
  protected readonly modelOptions = computed<SelectOption[]>(() => {
    const models = this.providersStore.modelsOf(this.provider());
    const current = this.model();
    const all = current && !models.includes(current) ? [current, ...models] : models;
    return all.map((model) => ({ value: model, label: model }));
  });

  constructor() {
    void this.providersStore.load();

    effect(() => {
      const id = this.id();
      if (id) untracked(() => void this.load(id));
    });

    // Al crear, el modelo parte del primero del proveedor elegido.
    effect(() => {
      const models = this.providersStore.modelsOf(this.provider());
      untracked(() => {
        if (!this.id() && !this.model() && models.length > 0) {
          this.form.controls.model.setValue(models[0]);
        }
      });
    });
  }

  protected fieldError(name: RequiredField): string | null {
    const control = this.form.controls[name];
    return control.touched && control.invalid ? 'Este campo es obligatorio' : null;
  }

  /** Cambiar de proveedor deja el modelo en el primero de ese proveedor. */
  protected onProviderChange(): void {
    const models = this.providersStore.modelsOf(this.form.controls.provider.value);
    this.form.controls.model.setValue(models[0] ?? '');
  }

  protected async submit(): Promise<void> {
    this.error.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = {
      ...this.form.getRawValue(),
      provider: this.form.controls.provider.value as AgentProvider,
      allowedTools: this.tools(),
    };
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
      this.savedProvider.set(agent.provider);
      this.form.patchValue({
        name: agent.name,
        provider: agent.provider,
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
