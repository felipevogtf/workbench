import { Inject, Injectable } from '@nestjs/common';
import { Issue } from '@tasks/domain/entities/issue.entity';
import { Label } from '@tasks/domain/entities/label.entity';
import { Project } from '@tasks/domain/entities/project.entity';
import { State } from '@tasks/domain/entities/state.entity';
import {
  ISSUE_REPOSITORY_PORT,
  type IssueRepositoryPort,
} from '@tasks/domain/ports/issue-repository.port';
import {
  LABEL_REPOSITORY_PORT,
  type LabelRepositoryPort,
} from '@tasks/domain/ports/label-repository.port';
import {
  PROJECT_REPOSITORY_PORT,
  type ProjectRepositoryPort,
} from '@tasks/domain/ports/project-repository.port';
import {
  STATE_REPOSITORY_PORT,
  type StateRepositoryPort,
} from '@tasks/domain/ports/state-repository.port';
import { htmlToText } from '@core/text/html-to-text';
import { composeGroupDescription } from '@tasks/domain/group-description';
import { IssueGroupsService } from './issue-groups.service';
import { IssuesService } from './issues.service';

const MAX_MEMBER_TEXT_CHARS = 8_000;

/** Un grupo de tareas tal como lo ven planificador y ejecuciones: ya compuesto. */
export interface GroupContext {
  /** Texto plano: las notas del grupo y una sección por tarea, en orden. */
  description: string;
  /** Las tareas del grupo, en orden; `key` es su código de Plane (`MEL-12`), si lo tiene. */
  members: { id: string; key: string | null; name: string }[];
  /** Las etiquetas de las tareas del grupo (de ahí salen sus repositorios). */
  labels: Label[];
}

/**
 * Lo que el módulo `tasks` ofrece a los demás módulos (kanban, planner, time-tracking). Es su
 * puerta pública: los otros módulos no conocen sus repositorios, solo estas consultas y el cambio
 * de estado de una tarea.
 */
@Injectable()
export class TasksFacade {
  constructor(
    @Inject(ISSUE_REPOSITORY_PORT)
    private readonly issues: IssueRepositoryPort,
    @Inject(PROJECT_REPOSITORY_PORT)
    private readonly projects: ProjectRepositoryPort,
    @Inject(STATE_REPOSITORY_PORT)
    private readonly states: StateRepositoryPort,
    @Inject(LABEL_REPOSITORY_PORT)
    private readonly labels: LabelRepositoryPort,
    private readonly issuesService: IssuesService,
    private readonly groups: IssueGroupsService,
  ) {}

  findIssue(id: string): Promise<Issue | null> {
    return this.issues.findById(id);
  }

  findIssues(ids: string[]): Promise<Issue[]> {
    return this.issues.findByIds(ids);
  }

  findProject(id: string): Promise<Project | null> {
    return this.projects.findById(id);
  }

  findState(id: string): Promise<State | null> {
    return this.states.findById(id);
  }

  findLabels(ids: string[]): Promise<Label[]> {
    return this.labels.findByIds(ids);
  }

  /** El grupo al que pertenece una tarea, o `null`. */
  groupOf(issueId: string): Promise<string | null> {
    return this.groups.groupOf(issueId);
  }

  /** El grupo ya compuesto (su descripción, tareas y etiquetas); `null` si la tarea no es un grupo. */
  async groupContext(groupId: string): Promise<GroupContext | null> {
    const members = await this.groups.members(groupId);
    if (members.length === 0) return null;

    const group = await this.issues.findById(groupId);
    const entries = await Promise.all(
      members.map(async (member) => {
        // El código de Plane (MEL-12) solo existe si la tarea viene de allá.
        const project = member.isLocal
          ? null
          : await this.projects.findById(member.projectId);
        const key =
          project?.identifier && member.remoteSequence !== null
            ? `${project.identifier}-${member.remoteSequence}`
            : null;
        return {
          id: member.id,
          key,
          name: member.name,
          text: htmlToText(member.description, MAX_MEMBER_TEXT_CHARS) || null,
        };
      }),
    );
    const labelIds = [...new Set(members.flatMap((member) => member.labelIds))];
    return {
      description: composeGroupDescription(
        htmlToText(group?.description, MAX_MEMBER_TEXT_CHARS) || null,
        entries.map((entry) => ({
          key: entry.key,
          name: entry.name,
          description: entry.text,
        })),
      ),
      members: entries.map(({ id, key, name }) => ({ id, key, name })),
      labels: await this.labels.findByIds(labelIds),
    };
  }

  /** Todas las etiquetas (las que tienen enlace de repositorio dicen a cuál). */
  findAllLabels(): Promise<Label[]> {
    return this.labels.findAll();
  }

  /** Cambia el estado de una tarea (valida que el estado exista). */
  async setIssueState(issueId: string, stateId: string | null): Promise<void> {
    await this.issuesService.setState(issueId, stateId);
  }

  /** Elimina una tarea local (las de Plane no se pueden borrar). */
  deleteIssue(issueId: string): Promise<void> {
    return this.issuesService.deleteIssue(issueId);
  }
}
