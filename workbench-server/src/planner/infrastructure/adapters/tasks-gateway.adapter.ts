import { Injectable } from '@nestjs/common';
import { htmlToText } from '@core/text/html-to-text';
import { TasksFacade } from '@tasks/application/tasks-facade.service';
import {
  TaskContext,
  TasksGatewayPort,
} from '@planner/domain/ports/tasks-gateway.port';

const MAX_TEXT_CHARS = 20_000;

/** Único punto del planificador que conoce al módulo tasks. */
@Injectable()
export class TasksGatewayAdapter implements TasksGatewayPort {
  constructor(private readonly tasks: TasksFacade) {}

  async getTask(issueId: string): Promise<TaskContext | null> {
    const issue = await this.tasks.findIssue(issueId);
    if (!issue) return null;

    const [project, state, ownLabels, group, groupId] = await Promise.all([
      this.tasks.findProject(issue.projectId),
      issue.stateId ? this.tasks.findState(issue.stateId) : null,
      this.tasks.findLabels(issue.labelIds),
      this.tasks.groupContext(issue.id),
      this.tasks.groupOf(issue.id),
    ]);
    // Un grupo se compone de sus tareas: su descripción y sus repositorios salen de ellas.
    const labels = [...ownLabels, ...(group?.labels ?? [])];

    return {
      id: issue.id,
      name: issue.name,
      // La descripción de Plane llega como HTML; la local, como texto (el conversor la deja igual).
      description: group
        ? group.description
        : htmlToText(issue.description, MAX_TEXT_CHARS) || null,
      members:
        group?.members.map((member) => ({
          key: member.key,
          name: member.name,
        })) ?? [],
      groupId,
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
