/** Una tarea de un grupo, como la ve el usuario. */
export interface GroupMemberInfo {
  id: string;
  /** El código de Plane (`MEL-12`); `null` si no lo tiene. */
  key: string | null;
  name: string;
}

export interface GroupInfo {
  /** Las notas del grupo (qué depende de qué). */
  notes: string | null;
  members: GroupMemberInfo[];
}

/** Una tarea cualquiera, para abrirle una sesión. */
export interface TaskInfo {
  id: string;
  name: string;
  /** Es la tarea-grupo de un organizador, no una tarea suelta. */
  isGroup: boolean;
}

/** Contrato propio del organizador hacia los grupos del módulo tasks. */
export interface GroupsGatewayPort {
  /** Una tarea por su id; `null` si no existe. */
  findTask(id: string): Promise<TaskInfo | null>;
  /** Crea la tarea del grupo y devuelve su id. */
  createGroup(data: {
    title: string;
    projectId: string;
    notes?: string | null;
  }): Promise<string>;
  /** Las notas y las tareas del grupo, en orden. */
  getGroup(groupId: string): Promise<GroupInfo>;
  /** Deja como miembros exactamente estas tareas, en este orden. */
  setMembers(groupId: string, memberIds: string[]): Promise<void>;
  update(
    groupId: string,
    data: { title?: string; notes?: string | null },
  ): Promise<void>;
  /** Borra la tarea del grupo (sus tareas quedan libres). */
  delete(groupId: string): Promise<void>;
}

export const GROUPS_GATEWAY_PORT = Symbol('ORGANIZER_GROUPS_GATEWAY_PORT');
