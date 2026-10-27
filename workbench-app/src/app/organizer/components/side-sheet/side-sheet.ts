import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Icon } from '@shared/ui/icon/icon';
import { IconButton } from '@shared/ui/icon-button/icon-button';

/** Un panel que entra por la derecha sobre la pantalla: un título, una cruz para cerrarlo y el contenido que se le ponga. */
@Component({
  selector: 'app-side-sheet',
  imports: [Icon, IconButton],
  host: { '(document:keydown.escape)': 'closed.emit()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './side-sheet.html',
  styleUrl: './side-sheet.scss',
})
export class SideSheet {
  readonly heading = input.required<string>();
  readonly closed = output<void>();
}
