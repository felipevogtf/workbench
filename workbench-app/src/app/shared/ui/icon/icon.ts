import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ICONS, IconDef, IconName } from './icons';

@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
    '[style.width]': 'size()',
    '[style.height]': 'size()',
  },
  template: `
    <svg
      [attr.viewBox]="def().viewBox"
      [attr.fill]="def().kind === 'fill' ? 'currentColor' : 'none'"
      [attr.stroke]="def().kind === 'stroke' ? 'currentColor' : null"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      focusable="false"
    >
      @for (d of def().paths; track $index) {
        <path [attr.d]="d" />
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      flex: none;
    }

    svg {
      width: 100%;
      height: 100%;
    }
  `,
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly size = input('1.25em');

  protected readonly def = computed<IconDef>(() => ICONS[this.name()]);
}
