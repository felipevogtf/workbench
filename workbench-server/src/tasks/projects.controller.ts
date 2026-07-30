import { Controller, Get, Post } from '@nestjs/common';
import { ProjectsService } from './application/projects.service';
import { Project } from './domain/entities/project.entity';
import { ProjectResponseDto } from './dto/project-response.dto';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectService: ProjectsService) {}

  @Post('sync')
  async sync(): Promise<{ created: number; updated: number }> {
    return this.projectService.syncProjects();
  }

  @Get()
  async findAll(): Promise<ProjectResponseDto[]> {
    const projects: Project[] = await this.projectService.getAllProjects();
    return projects.map((project) => this.toResponseDto(project));
  }

  private toResponseDto(project: Project): ProjectResponseDto {
    return {
      id: project.id,
      name: project.name,
      syncedAt: project.syncedAt ? project.syncedAt.toISOString() : null,
      createdAt: project.createdAt.toISOString(),
    };
  }
}
