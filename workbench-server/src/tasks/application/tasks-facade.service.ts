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
import { IssuesService } from './issues.service';

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

  /** Cambia el estado de una tarea (valida que el estado exista). */
  async setIssueState(issueId: string, stateId: string | null): Promise<void> {
    await this.issuesService.setState(issueId, stateId);
  }

  /** Elimina una tarea local (las de Plane no se pueden borrar). */
  deleteIssue(issueId: string): Promise<void> {
    return this.issuesService.deleteIssue(issueId);
  }
}
