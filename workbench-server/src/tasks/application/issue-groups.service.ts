import { DomainError } from '@core/domain/domain.error';
import { Inject, Injectable } from '@nestjs/common';
import { Issue } from '@tasks/domain/entities/issue.entity';
import {
  ISSUE_GROUP_REPOSITORY_PORT,
  type IssueGroupRepositoryPort,
} from '@tasks/domain/ports/issue-group-repository.port';
import {
  ISSUE_REPOSITORY_PORT,
  type IssueRepositoryPort,
} from '@tasks/domain/ports/issue-repository.port';
import { IssuesService } from './issues.service';

/** Cuántas tareas puede juntar un grupo: más no cabe en una ejecución. */
export const MAX_GROUP_MEMBERS = 8;

/**
 * Grupos de tareas: una tarea local que reúne a otras para planificarlas y ejecutarlas juntas. Las notas del grupo son la
 * descripción de esa tarea; el resto lo arma `TasksFacade.groupContext`.
 */
@Injectable()
export class IssueGroupsService {
  constructor(
    @Inject(ISSUE_GROUP_REPOSITORY_PORT)
    private readonly groups: IssueGroupRepositoryPort,
    @Inject(ISSUE_REPOSITORY_PORT)
    private readonly issues: IssueRepositoryPort,
    private readonly issuesService: IssuesService,
  ) {}

  /** Crea la tarea del grupo (sin miembros todavía) en el proyecto dado. */
  createGroup(data: {
    title: string;
    projectId: string;
    notes?: string | null;
  }): Promise<Issue> {
    return this.issuesService.createIssue({
      name: data.title,
      description: data.notes ?? null,
      projectId: data.projectId,
      isGroup: true,
    });
  }

  /** Cambia el título del grupo y sus notas (qué depende de qué); lo que no se manda no cambia. */
  async updateGroup(
    groupId: string,
    data: { title?: string; notes?: string | null },
  ): Promise<Issue> {
    return this.issuesService.updateIssue(groupId, {
      ...(data.title !== undefined ? { name: data.title } : {}),
      ...(data.notes !== undefined ? { description: data.notes } : {}),
    });
  }

  /** Borra la tarea del grupo; sus tareas quedan libres. */
  deleteGroup(groupId: string): Promise<void> {
    return this.issuesService.deleteIssue(groupId);
  }

  /** Las tareas del grupo, en su orden. */
  async members(groupId: string): Promise<Issue[]> {
    const ids = await this.groups.memberIds(groupId);
    return this.inOrder(ids);
  }

  /**
   * Deja como miembros del grupo exactamente estas tareas, en este orden. Una tarea es de un solo grupo, un grupo no puede ser
   * miembro de otro y el grupo es una tarea local (las de Plane se sincronizan y no son grupos).
   */
  async setMembers(groupId: string, memberIds: string[]): Promise<Issue[]> {
    const group = await this.issues.findById(groupId);
    if (!group) {
      throw DomainError.notFound(`Issue with id ${groupId} not found`);
    }
    if (!group.isLocal) {
      throw new DomainError('Only a local task can be a group');
    }
    if (await this.groups.groupOf(groupId)) {
      throw new DomainError('A task that belongs to a group cannot be a group');
    }
    if (new Set(memberIds).size !== memberIds.length) {
      throw new DomainError('A task appears twice in the group');
    }
    if (memberIds.length > MAX_GROUP_MEMBERS) {
      throw new DomainError(
        `A group can have up to ${MAX_GROUP_MEMBERS} tasks`,
      );
    }
    if (memberIds.includes(groupId)) {
      throw new DomainError('A group cannot contain itself');
    }

    const found = await this.issues.findByIds(memberIds);
    for (const id of memberIds) {
      if (!found.some((issue) => issue.id === id)) {
        throw DomainError.notFound(`Issue with id ${id} not found`);
      }
      const other = await this.groups.groupOf(id);
      if (other && other !== groupId) {
        throw DomainError.conflict(
          'A task is already in another group; take it out of there first',
        );
      }
      if ((await this.groups.memberIds(id)).length > 0) {
        throw new DomainError('A group cannot be a member of another group');
      }
    }

    await this.groups.setMembers(groupId, memberIds);
    return this.inOrder(memberIds, found);
  }

  /** El grupo al que pertenece una tarea, o `null`. */
  groupOf(issueId: string): Promise<string | null> {
    return this.groups.groupOf(issueId);
  }

  private async inOrder(ids: string[], known?: Issue[]): Promise<Issue[]> {
    if (ids.length === 0) return [];
    const found = known ?? (await this.issues.findByIds(ids));
    return ids.flatMap((id) => found.filter((issue) => issue.id === id));
  }
}
