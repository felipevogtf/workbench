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
import {
  STATE_REPOSITORY_PORT,
  type StateRepositoryPort,
} from '@tasks/domain/ports/state-repository.port';
import {
  LABEL_REPOSITORY_PORT,
  type LabelRepositoryPort,
} from '@tasks/domain/ports/label-repository.port';
import { Issue } from '@tasks/domain/entities/issue.entity';

interface IssueData {
  name: string;
  description?: string | null;
  projectId: string;
  stateId?: string | null;
  priority?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  estimatedHours?: number | null;
  labelIds?: string[];
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
    @Inject(STATE_REPOSITORY_PORT)
    private readonly stateRepository: StateRepositoryPort,
    @Inject(LABEL_REPOSITORY_PORT)
    private readonly labelRepository: LabelRepositoryPort,
  ) {}

  async createIssue(data: IssueData): Promise<Issue> {
    await this.ensureProject(data.projectId);

    const localSequence = await this.issueRepository.nextLocalSequence(
      data.projectId,
    );

    const issue = Issue.createLocal({
      name: data.name,
      description: data.description || null,
      projectId: data.projectId,
      localSequence,
    });
    await this.applyOptionalFields(issue, data);

    await this.issueRepository.save(issue);
    return issue;
  }

  async updateIssue(id: string, data: Partial<IssueData>): Promise<Issue> {
    const existingIssue = await this.getIssueById(id);

    if (data.name !== undefined) {
      existingIssue.rename(data.name);
    }
    if (data.description !== undefined) {
      existingIssue.updateDescription(data.description);
    }
    if (data.projectId !== undefined) {
      await this.ensureProject(data.projectId);
      existingIssue.changeProject(data.projectId);
    }
    await this.applyOptionalFields(existingIssue, data);

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

  async setState(id: string, stateId: string | null): Promise<Issue> {
    const existingIssue = await this.getIssueById(id);
    await this.ensureState(stateId);

    existingIssue.setState(stateId);
    await this.issueRepository.save(existingIssue);
    return existingIssue;
  }

  /** Cierra tareas (pasan al historial). Devuelve cuántas cambiaron: las que ya estaban cerradas no cuentan. */
  closeIssues(ids: string[]): Promise<number> {
    return this.issueRepository.setClosed(ids, new Date());
  }

  /** Reabre tareas cerradas; vuelven con el estado que tenían. */
  reopenIssues(ids: string[]): Promise<number> {
    return this.issueRepository.setClosed(ids, null);
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
          estimatedHours: raw.estimatePoint,
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
          estimatedHours: raw.estimatePoint,
          closedAt: null,
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

  // Campos que se pueden editar en una tarea. undefined = sin cambios,
  // null = limpiar el valor.
  private async applyOptionalFields(
    issue: Issue,
    data: Partial<IssueData>,
  ): Promise<void> {
    if (data.priority !== undefined) {
      issue.setPriority(data.priority);
    }
    if (data.startDate !== undefined || data.dueDate !== undefined) {
      issue.setDates({ startDate: data.startDate, dueDate: data.dueDate });
    }
    if (data.estimatedHours !== undefined) {
      issue.setEstimatedHours(data.estimatedHours);
    }
    if (data.stateId !== undefined) {
      await this.ensureState(data.stateId);
      issue.setState(data.stateId);
    }
    if (data.labelIds !== undefined) {
      const ids = [...new Set(data.labelIds)];
      const labels = await this.labelRepository.findByIds(ids);
      if (labels.length !== ids.length) {
        throw new NotFoundException('One or more labels were not found');
      }
      issue.setLabels(ids);
    }
  }

  private async ensureProject(projectId: string): Promise<void> {
    if (!(await this.projectRepository.findById(projectId))) {
      throw new NotFoundException(`Project with id ${projectId} not found`);
    }
  }

  private async ensureState(stateId: string | null): Promise<void> {
    if (stateId !== null && !(await this.stateRepository.findById(stateId))) {
      throw new NotFoundException(`State with id ${stateId} not found`);
    }
  }
}
