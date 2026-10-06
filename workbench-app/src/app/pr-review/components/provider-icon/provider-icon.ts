import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';
import { Icon } from '@shared/ui/icon/icon';
import { GitProvider, PROVIDER_LABEL } from '../../models/pull-request';

@Component({
  selector: 'app-provider-icon',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-icon [name]="provider()" size="1.1rem" [attr.title]="label[provider()]" />
    @if (showLabel()) {
      <span>{{ label[provider()] }}</span>
    } @else {
      <span class="visually-hidden">{{ label[provider()] }}</span>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
    }
  `,
})
export class ProviderIcon {
  readonly provider = input.required<GitProvider>();
  readonly showLabel = input(false, { transform: booleanAttribute });

  protected readonly label = PROVIDER_LABEL;
}
