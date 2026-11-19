/** `group`: varias tareas en un grupo. `task`: una sola tarea que se planifica sin grupo (no se renombra ni se le suman tareas). */
export type OrganizerSessionKind = 'group' | 'task';

/** Una sesión del organizador, tal como sale en la lista. */
export interface OrganizerSessionSummary {
  id: string;
  title: string;
  kind: OrganizerSessionKind;
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
  kind: OrganizerSessionKind;
  groupIssueId: string;
  /** Las notas del grupo: qué depende de qué. */
  notes: string | null;
  /** Los proyectos (repositorios `org/repo`) donde se trabaja; vacío = los de las etiquetas de sus tareas. */
  projectRepos: string[];
  /** Las tareas, en el orden en que se hacen. */
  members: OrganizerMember[];
  createdAt: string;
}

/**
 * Una sesión nueva. No hace falta nada: sin título es una conversación nueva (el primer mensaje la renombra) y los proyectos
 * (repositorios) y los tickets se suman después. Con `projectId` (proyecto de tareas) el grupo vive ahí, para reunir tickets de Plane.
 */
export interface NewOrganizerSession {
  title?: string;
  projectId?: string;
  projectRepos?: string[];
  notes?: string;
}

/** Cuántos proyectos (repositorios) admite una sesión: lo mismo que una ejecución. */
export const MAX_SESSION_PROJECTS = 3;

/** Cuántas tareas caben en un grupo (lo mismo que acepta el servidor). */
export const MAX_GROUP_MEMBERS = 8;
