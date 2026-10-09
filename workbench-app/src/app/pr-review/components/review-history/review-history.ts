import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TimeAgoPipe } from '@shared/pipes/time-ago';
import { Badge } from '@shared/ui/badge/badge';
import { Icon } from '@shared/ui/icon/icon';
import { IconButton } from '@shared/ui/icon-button/icon-button';
import { TextButton } from '@shared/ui/text-button/text-button';
import { Review, shortCommit } from '../../models/pull-request';

/** Historial de revisiones de una PR. Las correctas se pueden abrir para leer su Markdown; cualquiera se puede eliminar. */
@Component({
  selector: 'app-review-history',
  imports: [TimeAgoPipe, Badge, Icon, IconButton, TextButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './review-history.html',
  styleUrl: './review-history.scss',
})
export class ReviewHistory {
  readonly reviews = input.required<readonly Review[]>();
  readonly selectedId = input<string | null>(null);

  readonly reviewSelected = output<Review>();
  readonly reviewDeleted = output<Review>();

  protected readonly short = shortCommit;
}
