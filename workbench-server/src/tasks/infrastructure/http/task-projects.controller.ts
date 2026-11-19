import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TaskProjectsService } from '@tasks/application/task-projects.service';
import { TaskProject } from '@tasks/domain/entities/task-project.entity';
import { CreateTaskProjectDto } from '@tasks/dto/create-task-project.dto';
import { UpdateTaskProjectDto } from '@tasks/dto/update-task-project.dto';
import { TaskProjectResponseDto } from '@tasks/dto/task-project-response.dto';

@Controller('task-projects')
export class TaskProjectsController {
  constructor(
    private readonly projectService: TaskProjectsService,
    private readonly config: ConfigService,
  ) {}

  @Post()
  async create(
    @Body() createProjectDto: CreateTaskProjectDto,
  ): Promise<TaskProjectResponseDto> {
    const project = await this.projectService.createProject(createProjectDto);
    return this.toResponseDto(project);
  }

  @Post('sync')
  async sync(): Promise<{ created: number; updated: number }> {
    return this.projectService.syncProjects();
  }

  @Get()
  async findAll(): Promise<TaskProjectResponseDto[]> {
    const projects: TaskProject[] = await this.projectService.getAllProjects();
    return projects.map((project) => this.toResponseDto(project));
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateProjectDto: UpdateTaskProjectDto,
  ): Promise<TaskProjectResponseDto> {
    const project = await this.projectService.updateProject(
      id,
      updateProjectDto,
    );
    return this.toResponseDto(project);
  }

  @Delete(':id')
  async delete(@Param('id') id: string): Promise<void> {
    await this.projectService.deleteProject(id);
  }

  /** `<PLANE_API_URL>/<workspace>/browse/`: con la clave de la tarea (MEL-253/) forma su enlace. */
  private planeBrowseUrl(): string | null {
    const base = (this.config.get<string>('PLANE_API_URL') ?? '').replace(
      /\/+$/,
      '',
    );
    const workspace = this.config.get<string>('PLANE_WORKSPACE_SLUG');
    return base && workspace ? `${base}/${workspace}/browse/` : null;
  }

  private toResponseDto(project: TaskProject): TaskProjectResponseDto {
    return {
      id: project.id,
      name: project.name,
      externalId: project.externalId,
      source: project.source,
      identifier: project.identifier,
      syncEnabled: project.syncEnabled,
      visible: project.visible,
      ticketBaseUrl: project.source === 'plane' ? this.planeBrowseUrl() : null,
      syncedAt: project.syncedAt ? project.syncedAt.toISOString() : null,
      createdAt: project.createdAt.toISOString(),
    };
  }
}
