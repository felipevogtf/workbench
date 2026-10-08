import { Injectable } from '@nestjs/common';
import { TasksFacade } from '@tasks/application/tasks-facade.service';
import { IssueOriginPort } from '@time-tracking/domain/ports/issue-origin.port';

@Injectable()
export class TasksIssueOriginAdapter implements IssueOriginPort {
  constructor(private readonly tasks: TasksFacade) {}

  async findLocalIds(issueIds: readonly string[]): Promise<Set<string>> {
    if (issueIds.length === 0) return new Set();

    const issues = await this.tasks.findIssues([...issueIds]);
    return new Set(
      issues.filter((issue) => issue.isLocal).map((issue) => issue.id),
    );
  }
}
