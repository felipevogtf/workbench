import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Alert } from '@shared/ui/alert/alert';
import { Badge } from '@shared/ui/badge/badge';
import { Button } from '@shared/ui/button/button';
import { Card } from '@shared/ui/card/card';
import { Icon } from '@shared/ui/icon/icon';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { Skeleton } from '@shared/ui/skeleton/skeleton';
import { DiffFile, STATUS_TONE } from '../../components/diff-file/diff-file';
import { PullRequestDiffStore } from '../../data-access/pull-request-diff.store';
import { DIFF_STATUS_LABEL } from '../../models/diff';
import { PROVIDER_LABEL } from '../../models/pull-request';

/** Cambios de una PR: lista de archivos a la izquierda y su diff lado a lado a la derecha. */
@Component({
  selector: 'app-pull-request-diff-page',
  imports: [RouterLink, PageHeader, Button, Card, Icon, Alert, Badge, Skeleton, DiffFile],
  providers: [PullRequestDiffStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pull-request-diff-page.html',
  styleUrl: './pull-request-diff-page.scss',
})
export class PullRequestDiffPage {
  /** Viene de la ruta `:id`. */
  readonly id = input.required<string>();

  protected readonly store = inject(PullRequestDiffStore);
  protected readonly providerLabel = PROVIDER_LABEL;
  protected readonly statusLabel = DIFF_STATUS_LABEL;
  protected readonly statusTone = STATUS_TONE;

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => void this.store.load(id));
    });
  }
}
