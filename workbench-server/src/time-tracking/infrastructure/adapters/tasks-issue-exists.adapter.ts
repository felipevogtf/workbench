import { Inject, Injectable } from '@nestjs/common';
import {
  ISSUE_REPOSITORY_PORT,
  type IssueRepositoryPort,
} from '@tasks/domain/ports/issue-repository.port';
import { IssueExistsPort } from '@time-tracking/domain/ports/issue-exists.port';

@Injectable()
export class TasksIssueExistsAdapter implements IssueExistsPort {
  constructor(
    @Inject(ISSUE_REPOSITORY_PORT)
    private readonly issueRepository: IssueRepositoryPort,
  ) {}

  async exists(issueId: string): Promise<boolean> {
    return (await this.issueRepository.findById(issueId)) !== null;
  }
}
