import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { copyText } from '@shared/util/copy-text';
import { TimeAgoPipe } from '@shared/pipes/time-ago';
import { Alert } from '@shared/ui/alert/alert';
import { Badge } from '@shared/ui/badge/badge';
import { Button } from '@shared/ui/button/button';
import { Card } from '@shared/ui/card/card';
import { ConfirmDialog } from '@shared/ui/confirm-dialog/confirm-dialog';
import { EmptyState } from '@shared/ui/empty-state/empty-state';
import { Icon } from '@shared/ui/icon/icon';
import { IconButton } from '@shared/ui/icon-button/icon-button';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { Skeleton } from '@shared/ui/skeleton/skeleton';
import { Toast } from '@shared/ui/toast/toast';
import { RunnerNameDialog } from '../../components/runner-name-dialog/runner-name-dialog';
import { RunnersStore } from '../../data-access/runners.store';
import { Runner } from '../../models/execution';

/** Alta y estado de los runners: los programas de un PC que hacen el trabajo de las ejecuciones. */
@Component({
  selector: 'app-runners-page',
  imports: [
    TimeAgoPipe,
    Alert,
    Badge,
    Button,
    Card,
    EmptyState,
    Icon,
    IconButton,
    PageHeader,
    Skeleton,
    RunnerNameDialog,
  ],
  providers: [RunnersStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './runners-page.html',
  styleUrl: './runners-page.scss',
})
export class RunnersPage {
  protected readonly store = inject(RunnersStore);
  private readonly confirm = inject(ConfirmDialog);
  private readonly toast = inject(Toast);

  protected readonly dialogOpen = signal(false);
  protected readonly create = (name: string): Promise<boolean> => this.store.create(name);

  /** El archivo de configuración que lleva el token recién creado. */
  protected readonly configSnippet = computed(() => {
    const created = this.store.created();
    return created
      ? JSON.stringify(
          {
            serverUrl: `${location.origin}/api`,
            token: created.token,
            workDir: 'E:\\workbench-agent-repos',
          },
          null,
          2,
        )
      : '';
  });

  constructor() {
    void this.store.load(inject(DestroyRef));
  }

  protected reload(): void {
    void this.store.load();
  }

  protected async copy(text: string, what: string): Promise<void> {
    try {
      await copyText(text);
      this.toast.success(`${what} copiado`);
    } catch {
      this.toast.error('No se pudo copiar; selecciónalo y cópialo a mano');
    }
  }

  protected async remove(runner: Runner): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Revocar el runner',
      message: `«${runner.name}» deja de poder tomar trabajo y su token deja de servir. Lo que esté haciendo se da por perdido.`,
      confirmLabel: 'Revocar',
      tone: 'danger',
    });
    if (confirmed) await this.store.remove(runner);
  }
}
