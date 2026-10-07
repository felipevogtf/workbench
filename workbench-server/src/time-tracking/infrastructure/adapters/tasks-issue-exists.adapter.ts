import { Injectable } from '@nestjs/common';
import { TasksFacade } from '@tasks/application/tasks-facade.service';
import { IssueExistsPort } from '@time-tracking/domain/ports/issue-exists.port';

@Injectable()
export class TasksIssueExistsAdapter implements IssueExistsPort {
  constructor(private readonly tasks: TasksFacade) {}

  async exists(issueId: string): Promise<boolean> {
    return (await this.tasks.findIssue(issueId)) !== null;
  }
}
