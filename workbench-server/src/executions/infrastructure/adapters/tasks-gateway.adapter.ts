import { Injectable } from '@nestjs/common';
import { htmlToText } from '@core/text/html-to-text';
import { TasksFacade } from '@tasks/application/tasks-facade.service';
import {
  ExecutionTask,
  TasksGatewayPort,
} from '@executions/domain/ports/gateways.port';

const MAX_TEXT_CHARS = 20_000;

/** Único punto de la ejecución que conoce al módulo tasks. */
@Injectable()
export class TasksGatewayAdapter implements TasksGatewayPort {
  constructor(private readonly tasks: TasksFacade) {}

  async getTask(issueId: string): Promise<ExecutionTask | null> {
    const issue = await this.tasks.findIssue(issueId);
    if (!issue) return null;

    const labels = await this.tasks.findLabels(issue.labelIds);
    const repoUrls = [...labels]
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
      .flatMap((label) => (label.repoUrl ? [label.repoUrl] : []));

    // El código de Plane (MEL-12) solo existe si la tarea viene de allá: una tarea local no lo tiene.
    const project = issue.isLocal
      ? null
      : await this.tasks.findProject(issue.projectId);
    const key =
      project?.identifier && issue.remoteSequence !== null
        ? `${project.identifier}-${issue.remoteSequence}`
        : null;

    return {
      id: issue.id,
      name: issue.name,
      description: htmlToText(issue.description, MAX_TEXT_CHARS) || null,
      repoUrls: [...new Set(repoUrls)],
      key,
    };
  }
}
