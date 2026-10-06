// src/kanban/infrastructure/adapters/tasks-gateway.adapter.ts
import { Inject, Injectable } from '@nestjs/common';
import {
  ISSUE_REPOSITORY_PORT,
  type IssueRepositoryPort,
} from '@tasks/domain/ports/issue-repository.port';
import {
  STATE_REPOSITORY_PORT,
  type StateRepositoryPort,
} from '@tasks/domain/ports/state-repository.port';
import {
  BoardIssueRef,
  TasksGatewayPort,
} from '@kanban/domain/ports/tasks-gateway.port';

@Injectable()
export class TasksGatewayAdapter implements TasksGatewayPort {
  constructor(
    @Inject(ISSUE_REPOSITORY_PORT)
    private readonly issueRepository: IssueRepositoryPort,
    @Inject(STATE_REPOSITORY_PORT)
    private readonly stateRepository: StateRepositoryPort,
  ) {}

  async issueExists(issueId: string): Promise<boolean> {
    return (await this.issueRepository.findById(issueId)) !== null;
  }

  async findIssueRefsByIds(issueIds: string[]): Promise<BoardIssueRef[]> {
    const issues = await this.issueRepository.findByIds(issueIds);
    return issues.map((issue) => ({ id: issue.id, stateId: issue.stateId }));
  }

  async setIssueState(issueId: string, stateId: string | null): Promise<void> {
    const issue = await this.issueRepository.findById(issueId);
    if (!issue) {
      throw new Error(`Issue with id ${issueId} not found`);
    }
    issue.setState(stateId);
    await this.issueRepository.save(issue);
  }

  async stateExists(stateId: string): Promise<boolean> {
    return (await this.stateRepository.findById(stateId)) !== null;
  }
}
