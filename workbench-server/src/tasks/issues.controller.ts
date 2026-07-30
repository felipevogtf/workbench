import { Controller, Get, Param, Post } from '@nestjs/common';
import { IssueResponseDto } from './dto/issue-response.dto';
import { Issue } from './domain/entities/issue.entity';
import { IssuesService } from './application/issues.service';

@Controller('issues')
export class IssuesController {
  constructor(private readonly issuesService: IssuesService) {}

  @Post('projects/:projectId/sync')
  async sync(
    @Param('projectId') projectId: string,
  ): Promise<{ created: number; updated: number }> {
    return this.issuesService.syncByProject(projectId);
  }

  @Get()
  async findAll(): Promise<IssueResponseDto[]> {
    const issues: Issue[] = await this.issuesService.getAllIssues();
    return issues.map((issue) => this.toResponseDto(issue));
  }

  @Get('projects/:projectId')
  async findByProject(
    @Param('projectId') projectId: string,
  ): Promise<IssueResponseDto[]> {
    const issues = await this.issuesService.getIssuesByProject(projectId);
    return issues.map((issue) => this.toResponseDto(issue));
  }

  private toResponseDto(issue: Issue): IssueResponseDto {
    return {
      id: issue.id,
      name: issue.name,
      isLocal: issue.isLocal,
      externalId: issue.externalId,
      sequenceNumber: issue.sequenceNumber,
      localId: issue.localId,
      externalState: issue.externalState,
      description: issue.description,
      priority: issue.priority,
      hoursWorked: issue.hoursWorked,
      stateId: issue.stateId,
      projectId: issue.projectId,
      labelIds: issue.labelIds,
      startDate: issue.startDate,
      dueDate: issue.dueDate,
    };
  }
}
