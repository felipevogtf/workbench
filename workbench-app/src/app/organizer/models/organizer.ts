/** Una sesión del organizador, tal como sale en la lista. */
export interface OrganizerSessionSummary {
  id: string;
  title: string;
  /** La tarea del grupo: con su id se conversa, se planifica y se ejecuta, como con cualquier tarea. */
  groupIssueId: string;
  memberCount: number;
  createdAt: string;
}

/** Una tarea del grupo. */
export interface OrganizerMember {
  id: string;
  /** El código de Plane (`MEL-12`); `null` si no lo tiene. */
  key: string | null;
  name: string;
}

export interface OrganizerSession {
  id: string;
  title: string;
  groupIssueId: string;
  /** Las notas del grupo: qué depende de qué. */
  notes: string | null;
  /** Las tareas, en el orden en que se hacen. */
  members: OrganizerMember[];
  createdAt: string;
}

export interface NewOrganizerSession {
  title: string;
  projectId: string;
  notes?: string;
}

/** Cuántas tareas caben en un grupo (lo mismo que acepta el servidor). */
export const MAX_GROUP_MEMBERS = 8;
