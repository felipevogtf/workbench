import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ProjectsService } from '@tasks/application/projects.service';
import { Project } from '@tasks/domain/entities/project.entity';
import { CreateProjectDto } from '@tasks/dto/create-project.dto';
import { UpdateProjectDto } from '@tasks/dto/update-project.dto';
import { ProjectResponseDto } from '@tasks/dto/project-response.dto';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectService: ProjectsService) {}

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

  private toResponseDto(project: Project): ProjectResponseDto {
    return {
      id: project.id,
      name: project.name,
      externalId: project.externalId,
      source: project.source,
      syncedAt: project.syncedAt ? project.syncedAt.toISOString() : null,
      createdAt: project.createdAt.toISOString(),
    };
  }
}
