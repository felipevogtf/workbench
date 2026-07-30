import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlaneApiClient } from '@tasks/infrastructure/clients/plane-api.client';
import { PlaneIssue } from '@tasks/infrastructure/clients/plane-api.types';
import {
  IssueSourcePort,
  RemoteIssueData,
} from '@tasks/domain/ports/issue-source.port';
import {
  ProjectSourcePort,
  RemoteProjectData,
} from '@tasks/domain/ports/project-source.port';

@Injectable()
export class PlaneApiAdapter implements ProjectSourcePort, IssueSourcePort {
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
