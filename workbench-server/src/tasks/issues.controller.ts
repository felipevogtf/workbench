import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { IssueResponseDto } from './dto/issue-response.dto';
import { Issue } from './domain/entities/issue.entity';
import { IssuesService } from './application/issues.service';
import { CreateIssueDto } from './dto/create-issue.dto';
import { UpdateIssueDto } from './dto/update-issue.dto';

@Controller('issues')
export class IssuesController {
  constructor(private readonly issuesService: IssuesService) {}

  @Post()
  async create(
    @Body() createIssueDto: CreateIssueDto,
  ): Promise<IssueResponseDto> {
    const issue: Issue = await this.issuesService.createIssue(createIssueDto);

    return this.toResponseDto(issue);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateIssueDto: UpdateIssueDto,
  ): Promise<IssueResponseDto> {
    const issue: Issue = await this.issuesService.updateIssue(
      id,
      updateIssueDto,
    );
    return this.toResponseDto(issue);
  }

  @Delete(':id')
  async delete(@Param('id') id: string): Promise<void> {
    await this.issuesService.deleteIssue(id);
  }

  @Post(':id/state/:stateId')
  async setState(
    @Param('id') id: string,
    @Param('stateId') stateId: string,
  ): Promise<IssueResponseDto> {
    const issue: Issue = await this.issuesService.setState(id, stateId);
    return this.toResponseDto(issue);
  }

  @Get(':id')
  async findById(@Param('id') id: string): Promise<IssueResponseDto> {
    const issue: Issue = await this.issuesService.getIssueById(id);

    return this.toResponseDto(issue);
  }

  @Get()
  async findAll(): Promise<IssueResponseDto[]> {
    const issues: Issue[] = await this.issuesService.getAllIssues();
    return issues.map((issue) => this.toResponseDto(issue));
  }

  @Post('projects/:projectId/sync')
  async sync(
    @Param('projectId') projectId: string,
  ): Promise<{ created: number; updated: number }> {
    return this.issuesService.syncByProject(projectId);
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
      estimatedHours: issue.estimatedHours,
      stateId: issue.stateId,
      projectId: issue.projectId,
      labelIds: issue.labelIds,
      startDate: issue.startDate,
      dueDate: issue.dueDate,
    };
  }
}
