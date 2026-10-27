import { Injectable } from '@nestjs/common';
import { htmlToText } from '@core/text/html-to-text';
import { IssueGroupsService } from '@tasks/application/issue-groups.service';
import { TasksFacade } from '@tasks/application/tasks-facade.service';
import {
  GroupInfo,
  GroupsGatewayPort,
} from '@organizer/domain/ports/groups-gateway.port';

const MAX_NOTES_CHARS = 20_000;

/** Único punto del organizador que conoce a los grupos del módulo tasks. */
@Injectable()
export class GroupsGatewayAdapter implements GroupsGatewayPort {
  constructor(
    private readonly groups: IssueGroupsService,
    private readonly tasks: TasksFacade,
  ) {}

  async createGroup(data: {
    title: string;
    projectId: string;
    notes?: string | null;
  }): Promise<string> {
    return (await this.groups.createGroup(data)).id;
  }

  async getGroup(groupId: string): Promise<GroupInfo> {
    const [issue, context] = await Promise.all([
      this.tasks.findIssue(groupId),
      this.tasks.groupContext(groupId),
    ]);
    return {
      notes: htmlToText(issue?.description, MAX_NOTES_CHARS) || null,
      members:
        context?.members.map((member) => ({
          id: member.id,
          key: member.key,
          name: member.name,
        })) ?? [],
    };
  }

  async setMembers(groupId: string, memberIds: string[]): Promise<void> {
    await this.groups.setMembers(groupId, memberIds);
  }

  async update(
    groupId: string,
    data: { title?: string; notes?: string | null },
  ): Promise<void> {
    await this.groups.updateGroup(groupId, data);
  }

  delete(groupId: string): Promise<void> {
    return this.groups.deleteGroup(groupId);
  }
}
