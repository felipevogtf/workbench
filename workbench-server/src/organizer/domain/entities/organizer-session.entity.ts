import { DomainError } from '@core/domain/domain.error';

export interface OrganizerSessionProps {
  id: string;
  title: string;
  /** La tarea local que hace de grupo: de ella cuelgan el plan, la conversación y la ejecución. */
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
  }): OrganizerSession {
    return new OrganizerSession({
      id: crypto.randomUUID(),
      title: OrganizerSession.cleanTitle(data.title),
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
