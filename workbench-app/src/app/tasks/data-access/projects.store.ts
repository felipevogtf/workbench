import { Injectable, computed, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '@core/api/api-error';
import { Toast } from '@shared/ui/toast/toast';
import { Project } from '../models/catalogs';
import { ResourceStore } from './resource-store';
import { TasksApi } from './tasks.api';

@Injectable({ providedIn: 'root' })
export class ProjectsStore extends ResourceStore<Project> {
  private readonly api = inject(TasksApi);
  private readonly toast = inject(Toast);

  readonly projects = computed(() =>
    [...this.items()].sort((a, b) => a.name.localeCompare(b.name, 'es')),
  );
  readonly projectById = computed(
    () => new Map(this.items().map((project) => [project.id, project])),
  );

  protected fetchAll() {
    return this.api.listProjects();
  }

  async create(name: string): Promise<Project> {
    const created = await firstValueFrom(this.api.createProject({ name }));
    this.add(created);
    return created;
  }

  async rename(id: string, name: string): Promise<Project> {
    const updated = await firstValueFrom(this.api.updateProject(id, { name }));
    this.replace(updated);
    return updated;
  }

  async remove(id: string): Promise<boolean> {
    try {
      await firstValueFrom(this.api.deleteProject(id));
      this.drop(id);
      this.toast.success('Proyecto eliminado');
      return true;
    } catch (error) {
      this.toast.error(errorMessage(error));
      return false;
    }
  }
}
