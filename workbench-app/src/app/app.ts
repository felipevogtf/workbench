import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Shell } from '@core/layout/shell/shell';
import { ConfirmHost } from '@shared/ui/confirm-dialog/confirm-host';
import { ToastHost } from '@shared/ui/toast/toast-host';

@Component({
  selector: 'app-root',
  imports: [Shell, ToastHost, ConfirmHost],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="noise" aria-hidden="true"></div>
    <app-shell />
    <app-toast-host />
    <app-confirm-host />
  `,
})
export class App {}
