import { Inject, Injectable } from '@nestjs/common';
import { htmlToText } from '@tasks/domain/html-to-text';
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
import {
  TaskContext,
  TasksGatewayPort,
} from '@planner/domain/ports/tasks-gateway.port';

const MAX_TEXT_CHARS = 20_000;

/** Único punto del planificador que conoce al módulo tasks. */
@Injectable()
export class TasksGatewayAdapter implements TasksGatewayPort {
  constructor(
    @Inject(ISSUE_REPOSITORY_PORT)
    private readonly issues: IssueRepositoryPort,
    @Inject(PROJECT_REPOSITORY_PORT)
    private readonly projects: ProjectRepositoryPort,
    @Inject(STATE_REPOSITORY_PORT)
    private readonly states: StateRepositoryPort,
    @Inject(LABEL_REPOSITORY_PORT)
    private readonly labels: LabelRepositoryPort,
  ) {}

  async getTask(issueId: string): Promise<TaskContext | null> {
    const issue = await this.issues.findById(issueId);
    if (!issue) return null;

    const [project, state, labels] = await Promise.all([
      this.projects.findById(issue.projectId),
      issue.stateId ? this.states.findById(issue.stateId) : null,
      this.labels.findByIds(issue.labelIds),
    ]);

    return {
      id: issue.id,
      name: issue.name,
      // La descripción de Plane llega como HTML; la local, como texto (el conversor la deja igual).
      description: htmlToText(issue.description, MAX_TEXT_CHARS) || null,
      projectName: project?.name ?? null,
      stateName: state?.name ?? null,
      priority: issue.priority,
      startDate: issue.startDate,
      dueDate: issue.dueDate,
      estimatedHours: issue.estimatedHours,
      isLocal: issue.isLocal,
      labels: labels.map((label) => ({
        name: label.name,
        repoUrl: label.repoUrl,
      })),
    };
  }
}
