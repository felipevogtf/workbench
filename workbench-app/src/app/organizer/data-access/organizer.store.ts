import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '@core/api/api-error';
import { Toast } from '@shared/ui/toast/toast';
import {
  NewOrganizerSession,
  OrganizerSession,
  OrganizerSessionSummary,
} from '../models/organizer';
import { OrganizerApi } from './organizer.api';

/** Las sesiones del organizador y la que está abierta. */
@Injectable({ providedIn: 'root' })
export class OrganizerStore {
  private readonly api = inject(OrganizerApi);
  private readonly toast = inject(Toast);

  private readonly sessionsState = signal<OrganizerSessionSummary[]>([]);
  private readonly loadingState = signal(false);
  private readonly errorState = signal<string | null>(null);
  private readonly currentState = signal<OrganizerSession | null>(null);
  private readonly savingState = signal(false);

  readonly sessions = this.sessionsState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  /** La sesión abierta en su pantalla; `null` mientras carga. */
  readonly current = this.currentState.asReadonly();
  readonly saving = this.savingState.asReadonly();

  async load(): Promise<void> {
    this.loadingState.set(true);
    this.errorState.set(null);
    try {
      this.sessionsState.set(await firstValueFrom(this.api.list()));
    } catch (error) {
      this.errorState.set(errorMessage(error));
    } finally {
      this.loadingState.set(false);
    }
  }

  /** Abre una sesión; devuelve si se pudo (si no, deja el motivo en `error`). */
  async open(id: string): Promise<boolean> {
    this.errorState.set(null);
    this.currentState.set(null);
    try {
      this.currentState.set(await firstValueFrom(this.api.get(id)));
      return true;
    } catch (error) {
      this.errorState.set(errorMessage(error));
      return false;
    }
  }

  async create(input: NewOrganizerSession): Promise<OrganizerSession | null> {
    this.savingState.set(true);
    try {
      const created = await firstValueFrom(this.api.create(input));
      this.sessionsState.update((list) => [
        {
          id: created.id,
          title: created.title,
          groupIssueId: created.groupIssueId,
          memberCount: created.members.length,
          createdAt: created.createdAt,
        },
        ...list,
      ]);
      return created;
    } catch (error) {
      this.toast.error(errorMessage(error));
      return null;
    } finally {
      this.savingState.set(false);
    }
  }

  async setMembers(id: string, issueIds: string[]): Promise<boolean> {
    return this.change(id, () => this.api.setMembers(id, issueIds));
  }

  async update(id: string, patch: { title?: string; notes?: string }): Promise<boolean> {
    return this.change(id, () => this.api.update(id, patch));
  }

  async remove(id: string): Promise<boolean> {
    try {
      await firstValueFrom(this.api.remove(id));
      this.sessionsState.update((list) => list.filter((session) => session.id !== id));
      if (this.currentState()?.id === id) this.currentState.set(null);
      return true;
    } catch (error) {
      this.toast.error(errorMessage(error));
      return false;
    }
  }

  private async change(id: string, call: () => ReturnType<OrganizerApi['get']>): Promise<boolean> {
    this.savingState.set(true);
    try {
      const updated = await firstValueFrom(call());
      if (this.currentState()?.id === id) this.currentState.set(updated);
      this.sessionsState.update((list) =>
        list.map((session) =>
          session.id === id
            ? { ...session, title: updated.title, memberCount: updated.members.length }
            : session,
        ),
      );
      return true;
    } catch (error) {
      this.toast.error(errorMessage(error));
      return false;
    } finally {
      this.savingState.set(false);
    }
  }
}
