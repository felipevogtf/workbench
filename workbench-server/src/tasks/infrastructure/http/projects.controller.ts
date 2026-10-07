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
import { ProjectsService } from '@tasks/application/projects.service';
import { Project } from '@tasks/domain/entities/project.entity';
import { CreateProjectDto } from '@tasks/dto/create-project.dto';
import { UpdateProjectDto } from '@tasks/dto/update-project.dto';
import { ProjectResponseDto } from '@tasks/dto/project-response.dto';

@Controller('projects')
export class ProjectsController {
  constructor(
    private readonly projectService: ProjectsService,
    private readonly config: ConfigService,
  ) {}

  @Post()
  async create(
    @Body() createProjectDto: CreateProjectDto,
  ): Promise<ProjectResponseDto> {
    const project = await this.projectService.createProject(createProjectDto);
    return this.toResponseDto(project);
  }

  @Post('sync')
  async sync(): Promise<{ created: number; updated: number }> {
    return this.projectService.syncProjects();
  }

  @Get()
  async findAll(): Promise<ProjectResponseDto[]> {
    const projects: Project[] = await this.projectService.getAllProjects();
    return projects.map((project) => this.toResponseDto(project));
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateProjectDto: UpdateProjectDto,
  ): Promise<ProjectResponseDto> {
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

  private toResponseDto(project: Project): ProjectResponseDto {
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
