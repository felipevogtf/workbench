export interface IssueGroupRepositoryPort {
  /** Los ids de los miembros del grupo, en su orden; vacío si no es un grupo. */
  memberIds(groupId: string): Promise<string[]>;
  /** El grupo al que pertenece una tarea, o `null`. */
  groupOf(memberId: string): Promise<string | null>;
  /** Deja como miembros del grupo exactamente estos, en este orden. */
  setMembers(groupId: string, memberIds: string[]): Promise<void>;
}

export const ISSUE_GROUP_REPOSITORY_PORT = Symbol(
  'ISSUE_GROUP_REPOSITORY_PORT',
);
