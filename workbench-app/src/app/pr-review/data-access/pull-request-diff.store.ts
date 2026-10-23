import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '@core/api/api-error';
import { parseUnifiedDiff } from '../models/diff';
import { PullRequestDetail } from '../models/pull-request';
import { PullRequestsApi } from './pull-requests.api';

/** Estado de la pantalla de diff. Se provee a nivel de página, así que cada visita parte limpia. */
@Injectable()
export class PullRequestDiffStore {
  private readonly api = inject(PullRequestsApi);

  private readonly detailState = signal<PullRequestDetail | null>(null);
  private readonly diffState = signal('');
  private readonly loadingState = signal(false);
  private readonly errorState = signal<string | null>(null);
  private readonly selectedPathState = signal<string | null>(null);

  readonly detail = this.detailState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();

  readonly files = computed(() => parseUnifiedDiff(this.diffState()));
  readonly additions = computed(() => this.files().reduce((sum, f) => sum + f.additions, 0));
  readonly deletions = computed(() => this.files().reduce((sum, f) => sum + f.deletions, 0));

  /** El archivo elegido; mientras no se elija ninguno (o si desapareció), el primero. */
  readonly selected = computed(() => {
    const files = this.files();
    const path = this.selectedPathState();
    return files.find((file) => file.path === path) ?? files[0] ?? null;
  });

  async load(id: string): Promise<void> {
    this.loadingState.set(true);
    this.errorState.set(null);
    try {
      const [detail, diff] = await Promise.all([
        firstValueFrom(this.api.get(id)),
        firstValueFrom(this.api.diff(id)),
      ]);
      this.detailState.set(detail);
      this.diffState.set(diff);
      this.selectedPathState.set(null);
    } catch (error) {
      this.errorState.set(errorMessage(error));
    } finally {
      this.loadingState.set(false);
    }
  }

  select(path: string): void {
    this.selectedPathState.set(path);
  }
}
