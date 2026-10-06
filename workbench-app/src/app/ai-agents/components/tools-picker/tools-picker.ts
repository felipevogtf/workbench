import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { Checkbox } from '@shared/ui/checkbox/checkbox';

/** Casillas de herramientas permitidas. `[(selected)]` es la lista de las marcadas. */
@Component({
  selector: 'app-tools-picker',
  imports: [Checkbox],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <fieldset>
      <legend class="visually-hidden">Herramientas permitidas</legend>
      @for (tool of options(); track tool) {
        <app-checkbox [value]="selected().includes(tool)" (valueChange)="toggle(tool, $event)">
          <code>{{ tool }}</code>
        </app-checkbox>
      }
    </fieldset>
  `,
  styles: `
    fieldset {
      display: grid;
      grid-template-columns: 1fr;
      column-gap: var(--space-5);
      margin: 0;
      padding: 0;
      border: none;
    }

    code {
      font-family: var(--font-mono);
      font-size: 0.875rem;
      overflow-wrap: anywhere;
    }

    @media (min-width: 768px) {
      fieldset {
        grid-template-columns: 1fr 1fr;
      }
    }
  `,
})
export class ToolsPicker {
  readonly options = input.required<readonly string[]>();
  readonly selected = model.required<string[]>();

  protected toggle(tool: string, checked: boolean): void {
    this.selected.update((current) =>
      checked ? [...new Set([...current, tool])] : current.filter((item) => item !== tool),
    );
  }
}
