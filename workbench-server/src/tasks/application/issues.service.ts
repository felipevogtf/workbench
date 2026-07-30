import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PROJECT_REPOSITORY_PORT,
  type ProjectRepositoryPort,
} from '@tasks/domain/ports/project-repository.port';
import {
  ISSUE_SOURCE_PORT,
  type IssueSourcePort,
} from '@tasks/domain/ports/issue-source.port';
import {
  ISSUE_REPOSITORY_PORT,
  type IssueRepositoryPort,
} from '@tasks/domain/ports/issue-repository.port';
import { Issue } from '@tasks/domain/entities/issue.entity';

@Injectable()
export class IssuesService {
  constructor(
    @Inject(ISSUE_SOURCE_PORT)
    private readonly issueSource: IssueSourcePort,
    @Inject(ISSUE_REPOSITORY_PORT)
    private readonly issueRepository: IssueRepositoryPort,
    @Inject(PROJECT_REPOSITORY_PORT)
    private readonly projectRepository: ProjectRepositoryPort,
  ) {}

  async syncByProject(
    projectId: string,
  ): Promise<{ created: number; updated: number }> {
    const project = await this.projectRepository.findById(projectId);
    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }
    if (!project.externalId) {
      throw new BadRequestException(
        `Project ${projectId} is not linked to an external source`,
      );
    }

    const remoteIssues = await this.issueSource.getIssuesByProject(
      project.externalId,
    );

    let created = 0;
    let updated = 0;

    for (const raw of remoteIssues) {
      const existing = await this.issueRepository.findByExternalId(
        raw.externalId,
      );

      if (existing) {
        existing.syncFromRemote({
          name: raw.name,
          description: raw.description,
          externalState: raw.externalState,
          priority: raw.priority,
          sequenceNumber: raw.sequenceNumber,
          startDate: raw.startDate,
          dueDate: raw.dueDate,
        });
        await this.issueRepository.save(existing);
        updated++;
      } else {
        const issue = Issue.reconstruct({
          id: crypto.randomUUID(),
          name: raw.name,
          isLocal: false,
          externalId: raw.externalId,
          sequenceNumber: raw.sequenceNumber,
          localId: null,
          externalState: raw.externalState,
          description: raw.description,
          priority: raw.priority,
          hoursWorked: null,
          stateId: null,
          projectId: project.id,
          labelIds: [],
          startDate: raw.startDate,
          dueDate: raw.dueDate,
          syncedAt: new Date(),
          createdAt: new Date(),
        });
        await this.issueRepository.save(issue);
        created++;
      }
    }

    return { created, updated };
  }

  async getAllIssues(): Promise<Issue[]> {
    return this.issueRepository.findAll();
  }

  async getIssuesByProject(projectId: string): Promise<Issue[]> {
    return this.issueRepository.findByProjectId(projectId);
  }
}
