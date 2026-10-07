import { Injectable } from '@nestjs/common';
import { TasksFacade } from '@tasks/application/tasks-facade.service';
import {
  BoardIssueRef,
  TasksGatewayPort,
} from '@kanban/domain/ports/tasks-gateway.port';

/** Único punto de kanban que conoce al módulo tasks. */
@Injectable()
export class TasksGatewayAdapter implements TasksGatewayPort {
  constructor(private readonly tasks: TasksFacade) {}

  async issueExists(issueId: string): Promise<boolean> {
    return (await this.tasks.findIssue(issueId)) !== null;
  }

  async findIssueRefsByIds(issueIds: string[]): Promise<BoardIssueRef[]> {
    const issues = await this.tasks.findIssues(issueIds);
    return issues.map((issue) => ({ id: issue.id, stateId: issue.stateId }));
  }

  setIssueState(issueId: string, stateId: string | null): Promise<void> {
    return this.tasks.setIssueState(issueId, stateId);
  }

  async stateExists(stateId: string): Promise<boolean> {
    return (await this.tasks.findState(stateId)) !== null;
  }
}
