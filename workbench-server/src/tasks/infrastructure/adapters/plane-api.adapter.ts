import { ForbiddenException, HttpException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlaneApiClient } from '@tasks/infrastructure/clients/plane-api.client';
import {
  PlaneIssue,
  PlaneWorkItem,
} from '@tasks/infrastructure/clients/plane-api.types';
import {
  RemoteTicketData,
  TicketSourcePort,
} from '@tasks/domain/ports/ticket-source.port';
import {
  IssueSourcePort,
  RemoteIssueData,
} from '@tasks/domain/ports/issue-source.port';
import {
  ProjectSourcePort,
  RemoteProjectData,
} from '@tasks/domain/ports/project-source.port';

@Injectable()
export class PlaneApiAdapter
  implements ProjectSourcePort, IssueSourcePort, TicketSourcePort
{
  constructor(
    private readonly client: PlaneApiClient,
    private readonly config: ConfigService,
  ) {}

  async getProjects(): Promise<RemoteProjectData[]> {
    const userId = this.config.getOrThrow<string>('PLANE_USER_ID');
    const projectList = await this.client.getProjects();

    const myProjects: RemoteProjectData[] = [];
    for (const rawProject of projectList) {
      if (await this.isMember(rawProject.id, userId)) {
        myProjects.push({ externalId: rawProject.id, name: rawProject.name });
      }
    }

    return myProjects;
  }

  async getIssuesByProject(
    projectExternalId: string,
  ): Promise<RemoteIssueData[]> {
    const userId = this.config.getOrThrow<string>('PLANE_USER_ID');

    if (!(await this.isMember(projectExternalId, userId))) {
      throw new ForbiddenException(
        `You are not a member of project ${projectExternalId} in Plane`,
      );
    }

    const rawIssues = await this.client.getIssues(projectExternalId);

    return rawIssues.map((raw) => this.toRemoteIssueData(raw));
  }

  async getTicketByKey(key: string): Promise<RemoteTicketData | null> {
    try {
      return this.toRemoteTicketData(
        key,
        await this.client.getWorkItemByKey(key),
      );
    } catch (error) {
      // 404: la clave no existe. 403: el proyecto no es visible para la API key.
      if (
        error instanceof HttpException &&
        [403, 404].includes(error.getStatus())
      ) {
        return null;
      }
      throw error;
    }
  }

  async getProjectIdentifiers(): Promise<string[]> {
    const projects = await this.client.getProjects();
    return projects
      .map((project) => project.identifier)
      .filter((identifier): identifier is string => !!identifier);
  }

  private toRemoteTicketData(
    key: string,
    raw: PlaneWorkItem,
  ): RemoteTicketData {
    return {
      key,
      title: raw.name,
      stateName:
        typeof raw.state === 'object' ? (raw.state?.name ?? null) : null,
      labels: (raw.labels ?? [])
        .map((label) => (typeof label === 'object' ? label.name : null))
        .filter((name): name is string => !!name),
      priority: raw.priority,
      descriptionHtml: raw.description_html ?? null,
    };
  }

  private async isMember(projectId: string, userId: string): Promise<boolean> {
    const members = await this.client.getProjectMembers(projectId);
    return members.some((member) => member.id === userId);
  }

  private toRemoteIssueData(raw: PlaneIssue): RemoteIssueData {
    return {
      externalId: raw.id,
      sequenceNumber: raw.sequence_id,
      name: raw.name,
      description: raw.description_html ?? null,
      externalState: raw.state_detail?.name ?? raw.state,
      priority: raw.priority,
      startDate: raw.start_date,
      dueDate: raw.target_date,
    };
  }
}
