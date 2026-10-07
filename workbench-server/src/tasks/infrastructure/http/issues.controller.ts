import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { IssueResponseDto } from '@tasks/dto/issue-response.dto';
import { Issue } from '@tasks/domain/entities/issue.entity';
import { IssuesService } from '@tasks/application/issues.service';
import { CreateIssueDto } from '@tasks/dto/create-issue.dto';
import { CloseIssuesDto } from '@tasks/dto/close-issues.dto';
import { UpdateIssueDto } from '@tasks/dto/update-issue.dto';

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

  /** Cierra tareas (historial). Cuerpo: `{ ids: string[] }`. */
  @Post('close')
  @HttpCode(200)
  async close(@Body() dto: CloseIssuesDto): Promise<{ updated: number }> {
    return { updated: await this.issuesService.closeIssues(dto.ids ?? []) };
  }

  /** Reabre tareas cerradas. Cuerpo: `{ ids: string[] }`. */
  @Post('reopen')
  @HttpCode(200)
  async reopen(@Body() dto: CloseIssuesDto): Promise<{ updated: number }> {
    return { updated: await this.issuesService.reopenIssues(dto.ids ?? []) };
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
      remoteSequence: issue.remoteSequence,
      localSequence: issue.localSequence,
      externalState: issue.externalState,
      description: issue.description,
      priority: issue.priority,
      estimatedHours: issue.estimatedHours,
      closedAt: issue.closedAt ? issue.closedAt.toISOString() : null,
      stateId: issue.stateId,
      projectId: issue.projectId,
      labelIds: issue.labelIds,
      startDate: issue.startDate,
      dueDate: issue.dueDate,
    };
  }
}
