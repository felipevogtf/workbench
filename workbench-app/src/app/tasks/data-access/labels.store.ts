import { Injectable, computed, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '@core/api/api-error';
import { Toast } from '@shared/ui/toast/toast';
import { Label, LabelInput } from '../models/catalogs';
import { ResourceStore } from './resource-store';
import { TasksApi } from './tasks.api';

@Injectable({ providedIn: 'root' })
export class LabelsStore extends ResourceStore<Label> {
  private readonly api = inject(TasksApi);
  private readonly toast = inject(Toast);

  readonly labels = computed(() =>
    [...this.items()].sort((a, b) => a.name.localeCompare(b.name, 'es')),
  );
  readonly labelById = computed(() => new Map(this.items().map((label) => [label.id, label])));

  protected fetchAll() {
    return this.api.listLabels();
  }

  async create(input: LabelInput): Promise<Label> {
    const created = await firstValueFrom(this.api.createLabel(input));
    this.add(created);
    return created;
  }

  async update(id: string, patch: Partial<LabelInput>): Promise<Label> {
    const updated = await firstValueFrom(this.api.updateLabel(id, patch));
    this.replace(updated);
    return updated;
  }

  async remove(id: string): Promise<boolean> {
    try {
      await firstValueFrom(this.api.deleteLabel(id));
      this.drop(id);
      this.toast.success('Etiqueta eliminada');
      return true;
    } catch (error) {
      this.toast.error(errorMessage(error));
      return false;
    }
  }
}
