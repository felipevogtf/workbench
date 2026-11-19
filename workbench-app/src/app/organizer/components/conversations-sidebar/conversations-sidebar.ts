import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '@shared/ui/icon/icon';
import { Menu, MenuItem } from '@shared/ui/menu/menu';
import { Skeleton } from '@shared/ui/skeleton/skeleton';
import { OrganizerSessionSummary } from '../../models/organizer';

const MENU: MenuItem[] = [{ id: 'remove', label: 'Eliminar', icon: 'trash', tone: 'danger' }];

/**
 * La lista lateral de conversaciones del organizador, como la de un chat: «Nueva conversación» arriba y debajo las anteriores,
 * las más recientes primero. Abrir una es navegar a ella; la nueva no existe hasta el primer mensaje.
 */
@Component({
  selector: 'app-conversations-sidebar',
  imports: [RouterLink, Icon, Menu, Skeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="side" aria-label="Conversaciones">
      <a
        class="side__new"
        routerLink="/organizer"
        [class.side__new--active]="activeId() === null"
        [attr.aria-current]="activeId() === null ? 'page' : null"
        (click)="navigated.emit()"
      >
        <app-icon name="edit" size="1.1rem" />
        Nueva conversación
      </a>

      <h2 class="side__heading">Recientes</h2>

      @if (loading() && sessions().length === 0) {
        <div class="side__loading" aria-busy="true">
          <app-skeleton height="2rem" />
          <app-skeleton height="2rem" />
          <app-skeleton height="2rem" />
        </div>
      } @else if (sessions().length === 0) {
        <p class="side__empty">Todavía no hay conversaciones.</p>
      } @else {
        <ul class="side__list">
          @for (session of sessions(); track session.id) {
            <li class="side__item" [class.side__item--active]="session.id === activeId()">
              <a
                class="side__link"
                [routerLink]="['/organizer', session.id]"
                [title]="session.title"
                [attr.aria-current]="session.id === activeId() ? 'page' : null"
                (click)="navigated.emit()"
              >
                <span>{{ session.title }}</span>
              </a>
              <app-menu
                class="side__menu"
                [label]="'Acciones de ' + session.title"
                [items]="menu"
                (selected)="$event === 'remove' && removed.emit(session)"
              />
            </li>
          }
        </ul>
      }
    </nav>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
      min-height: 0;
    }

    .side {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      height: 100%;
      padding: var(--space-3) var(--space-2);
      overflow-y: auto;
      scrollbar-width: thin;
    }

    .side__new {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-sm);
      color: var(--text-color);
      font-weight: 500;
      text-decoration: none;

      &:hover,
      &--active {
        background: var(--tone-neutral-bg);
      }
    }

    .side__heading {
      margin: var(--space-3) 0 0;
      padding: 0 var(--space-3);
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--text-color);
      opacity: 0.7;
    }

    .side__loading {
      display: grid;
      gap: var(--space-1);
      padding: 0 var(--space-2);
    }

    .side__empty {
      margin: 0;
      padding: 0 var(--space-3);
      font-size: 0.875rem;
      color: var(--text-color);
      opacity: 0.7;
    }

    .side__list {
      display: flex;
      flex-direction: column;
      gap: 1px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .side__item {
      display: flex;
      align-items: center;
      border-radius: var(--radius-sm);

      &:hover,
      &--active {
        background: var(--tone-neutral-bg);
      }
    }

    // Cada fila mide lo mismo (2.25rem) y el título queda centrado en vertical, con o sin el menú a su lado.
    .side__link {
      flex: 1;
      display: flex;
      align-items: center;
      min-width: 0;
      min-height: 2.25rem;
      padding: 0 var(--space-3);
      color: var(--text-color);
      font-size: 0.9375rem;
      line-height: 1.2;
      text-decoration: none;

      > span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    // El menú de cada conversación solo se ve al pasar por ella (o con el foco).
    .side__menu {
      opacity: 0;
      flex: none;
      margin-right: var(--space-1);
    }

    // El botón del menú es más chico que el de las tablas, para que no agrande la fila.
    .side__menu ::ng-deep .menu__trigger {
      min-width: 1.75rem;
      min-height: 1.75rem;
      padding: 2px;
    }

    .side__item:hover .side__menu,
    .side__item:focus-within .side__menu,
    .side__item--active .side__menu {
      opacity: 1;
    }
  `,
})
export class ConversationsSidebar {
  readonly sessions = input.required<readonly OrganizerSessionSummary[]>();
  /** La conversación abierta; `null` = el chat nuevo. */
  readonly activeId = input<string | null>(null);
  readonly loading = input(false);

  /** Se eligió una (o el chat nuevo): en pantallas chicas, donde la lista es un panel, se cierra. */
  readonly navigated = output<void>();
  readonly removed = output<OrganizerSessionSummary>();

  protected readonly menu = MENU;
}
