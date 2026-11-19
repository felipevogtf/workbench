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
  /** Los proyectos (repositorios `org/repo`) donde se trabaja la sesión; vacío = los de las etiquetas de sus tareas. */
  projectRepos: string[];
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
  /**
   * Crea la tarea del grupo y devuelve su id. Sin `projectId` (una sesión libre) vive en el proyecto de tareas local de las
   * sesiones libres.
   */
  createGroup(data: {
    title: string;
    projectId?: string;
    projectRepos?: string[];
    notes?: string | null;
  }): Promise<string>;
  /** Crea una tarea local en el grupo, al final, con los mismos proyectos. Devuelve su id. */
  addNewMember(
    groupId: string,
    data: { name: string; description?: string | null },
  ): Promise<string>;
  /** Las notas y las tareas del grupo, en orden. */
  getGroup(groupId: string): Promise<GroupInfo>;
  /** Deja como miembros exactamente estas tareas, en este orden. */
  setMembers(groupId: string, memberIds: string[]): Promise<void>;
  update(
    groupId: string,
    data: {
      title?: string;
      notes?: string | null;
      /** Los proyectos (repositorios) de la sesión, exactamente estos. */
      projectRepos?: string[];
    },
  ): Promise<void>;
  /** Borra la tarea del grupo (sus tareas quedan libres). */
  delete(groupId: string): Promise<void>;
}

export const GROUPS_GATEWAY_PORT = Symbol('ORGANIZER_GROUPS_GATEWAY_PORT');
