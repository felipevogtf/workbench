import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
    '[style.width]': 'width()',
    '[style.height]': 'height()',
  },
  template: ``,
  styles: `
    :host {
      display: block;
      border-radius: var(--radius-sm);
      background: linear-gradient(
        90deg,
        rgba(20, 20, 20, 0.06) 25%,
        rgba(20, 20, 20, 0.12) 37%,
        rgba(20, 20, 20, 0.06) 63%
      );
      background-size: 400% 100%;
      animation: shimmer 1.4s ease infinite;
    }

    @keyframes shimmer {
      from {
        background-position: 100% 50%;
      }
      to {
        background-position: 0 50%;
      }
    }
  `,
})
export class Skeleton {
  readonly width = input('100%');
  readonly height = input('1rem');
}
