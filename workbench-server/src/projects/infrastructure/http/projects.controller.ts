import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ProjectsService } from '@projects/application/projects.service';
import { Project } from '@projects/domain/entities/project.entity';
import {
  CreateProjectDto,
  ProjectResponseDto,
  RepositoryOptionDto,
  UpdateProjectDto,
} from '@projects/dto/project.dto';

// `recipes` es el nombre de antes: se mantiene mientras la pantalla vieja pueda seguir abierta.
@Controller(['projects', 'recipes'])
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  async list(): Promise<ProjectResponseDto[]> {
    return (await this.projects.list()).map((project) => this.toDto(project));
  }

  /** Los repositorios de las etiquetas. Va antes de `:id`, que solo acepta UUID. */
  @Get('repositories')
  repositories(): Promise<RepositoryOptionDto[]> {
    return this.projects.repositories();
  }

  @Get(':id')
  async get(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ProjectResponseDto> {
    return this.toDto(await this.projects.get(id));
  }

  @Post()
  async create(@Body() dto: CreateProjectDto): Promise<ProjectResponseDto> {
    return this.toDto(await this.projects.create(dto));
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectDto,
  ): Promise<ProjectResponseDto> {
    return this.toDto(await this.projects.update(id, dto));
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.projects.remove(id);
  }

  private toDto(project: Project): ProjectResponseDto {
    return {
      id: project.id,
      repo: project.repo,
      name: project.name,
      content: project.content,
      dependsOn: [...project.dependsOn],
      mainBranch: project.mainBranch,
      runnerEnvironment: project.runnerEnvironment,
      architectureRules: project.architectureRules,
      verifyCommand: project.verifyCommand,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
  }
}
