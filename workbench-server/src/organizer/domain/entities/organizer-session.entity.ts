import { DomainError } from '@core/domain/domain.error';

/**
 * `group`: varias tareas que se planifican juntas, con su tarea-grupo. `task`: la sesión de UNA tarea cualquiera, que se planifica
 * sola; no hay grupo, así que `groupIssueId` es la propia tarea y la sesión nunca la borra ni la renombra.
 */
export type OrganizerSessionKind = 'group' | 'task';

export interface OrganizerSessionProps {
  id: string;
  title: string;
  kind: OrganizerSessionKind;
  /** La tarea de la que cuelgan el plan, la conversación y la ejecución: la del grupo o, en `task`, la propia tarea. */
  groupIssueId: string;
  createdAt: Date;
}

const MAX_TITLE = 200;

/** Una sesión del organizador: varias tareas que se planifican y se ejecutan juntas. */
export class OrganizerSession {
  private constructor(private props: OrganizerSessionProps) {}

  static create(data: {
    title: string;
    groupIssueId: string;
    kind?: OrganizerSessionKind;
  }): OrganizerSession {
    return new OrganizerSession({
      id: crypto.randomUUID(),
      title: OrganizerSession.cleanTitle(data.title),
      kind: data.kind ?? 'group',
      groupIssueId: data.groupIssueId,
      createdAt: new Date(),
    });
  }

  static reconstruct(props: OrganizerSessionProps): OrganizerSession {
    return new OrganizerSession(props);
  }

  static cleanTitle(title: string): string {
    const clean = title.trim();
    if (!clean) throw new DomainError('The session needs a title');
    return clean.slice(0, MAX_TITLE);
  }

  get id(): string {
    return this.props.id;
  }
  get title(): string {
    return this.props.title;
  }
  get kind(): OrganizerSessionKind {
    return this.props.kind;
  }
  get isTask(): boolean {
    return this.props.kind === 'task';
  }
  get groupIssueId(): string {
    return this.props.groupIssueId;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }

  rename(title: string): void {
    this.props.title = OrganizerSession.cleanTitle(title);
  }

  toProps(): OrganizerSessionProps {
    return { ...this.props };
  }
}
