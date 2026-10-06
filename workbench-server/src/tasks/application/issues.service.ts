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

interface CreateIssueData {
  name: string;
  description?: string | null;
  projectId: string;
  stateId?: string | null;
}

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

  async createIssue(data: CreateIssueData): Promise<Issue> {
    const project = await this.projectRepository.findById(data.projectId);
    if (!project) {
      throw new NotFoundException(
        `Project with id ${data.projectId} not found`,
      );
    }

    const localSequence = await this.issueRepository.nextLocalSequence(
      data.projectId,
    );

    const issue = Issue.createLocal({
      name: data.name,
      description: data.description || null,
      projectId: data.projectId,
      localSequence,
    });

    await this.issueRepository.save(issue);
    return issue;
  }

  async updateIssue(
    id: string,
    data: Partial<CreateIssueData>,
  ): Promise<Issue> {
    const existingIssue = await this.issueRepository.findById(id);
    if (!existingIssue) {
      throw new NotFoundException(`Issue with id ${id} not found`);
    }

    if (data.name !== undefined) {
      existingIssue.rename(data.name);
    }
    if (data.description !== undefined) {
      existingIssue.updateDescription(data.description);
    }
    if (data.projectId !== undefined) {
      const project = await this.projectRepository.findById(data.projectId);
      if (!project) {
        throw new NotFoundException(
          `Project with id ${data.projectId} not found`,
        );
      }

      existingIssue.changeProject(data.projectId);
    }

    await this.issueRepository.save(existingIssue);
    return existingIssue;
  }

  async deleteIssue(id: string): Promise<void> {
    const existingIssue = await this.issueRepository.findById(id);
    if (!existingIssue) {
      throw new NotFoundException(`Issue with id ${id} not found`);
    }

    if (!existingIssue.isLocal) {
      throw new BadRequestException(
        `Cannot delete issue with id ${id} because it is not a local issue`,
      );
    }

    await this.issueRepository.delete(id);
  }

  async setState(id: string, stateId: string): Promise<Issue> {
    const existingIssue = await this.issueRepository.findById(id);
    if (!existingIssue) {
      throw new NotFoundException(`Issue with id ${id} not found`);
    }

    const state = await this.issueRepository.findById(stateId);
    if (!state) {
      throw new NotFoundException(`State with id ${stateId} not found`);
    }

    existingIssue.setState(stateId);
    await this.issueRepository.save(existingIssue);
    return existingIssue;
  }

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
          remoteSequence: raw.sequenceNumber,
          startDate: raw.startDate,
          dueDate: raw.dueDate,
        });
        await this.issueRepository.save(existing);
        updated++;
      } else {
        const localSequence =
          await this.issueRepository.nextLocalSequence(projectId);

        const issue = Issue.reconstruct({
          id: crypto.randomUUID(),
          name: raw.name,
          isLocal: false,
          externalId: raw.externalId,
          remoteSequence: raw.sequenceNumber,
          localSequence,
          externalState: raw.externalState,
          description: raw.description,
          priority: raw.priority,
          estimatedHours: null,
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

  async getIssueById(id: string): Promise<Issue> {
    const issue = await this.issueRepository.findById(id);
    if (!issue) {
      throw new NotFoundException(`Issue with id ${id} not found`);
    }
    return issue;
  }

  async getAllIssues(): Promise<Issue[]> {
    return this.issueRepository.findAll();
  }

  async getIssuesByProject(projectId: string): Promise<Issue[]> {
    return this.issueRepository.findByProjectId(projectId);
  }
}
