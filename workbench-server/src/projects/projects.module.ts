import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RepoMirrorModule } from '@core/git/repo-mirror.module';
import { TasksModule } from '@tasks/tasks.module';
import { ProjectsFacade } from './application/projects-facade.service';
import { ProjectsService } from './application/projects.service';
import { PROJECT_REPOSITORY_PORT } from './domain/ports/project-repository.port';
import { REPOSITORY_MIRROR_PORT } from './domain/ports/repository-mirror.port';
import { REPOSITORY_OPTIONS_PORT } from './domain/ports/repository-options.port';
import { RepoMirrorAdapter } from './infrastructure/adapters/repo-mirror.adapter';
import { TasksRepositoryOptionsAdapter } from './infrastructure/adapters/tasks-repository-options.adapter';
import { ProjectsController } from './infrastructure/http/projects.controller';
import { ProjectOrmEntity } from './infrastructure/persistence/project.orm-entity';
import { TypeOrmProjectRepository } from './infrastructure/repositories/typeorm-project.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProjectOrmEntity]),
    TasksModule,
    RepoMirrorModule,
  ],
  controllers: [ProjectsController],
  providers: [
    ProjectsService,
    ProjectsFacade,
    { provide: PROJECT_REPOSITORY_PORT, useClass: TypeOrmProjectRepository },
    { provide: REPOSITORY_MIRROR_PORT, useClass: RepoMirrorAdapter },
    {
      provide: REPOSITORY_OPTIONS_PORT,
      useClass: TasksRepositoryOptionsAdapter,
    },
  ],
  // Los otros módulos entran solo por la facade.
  exports: [ProjectsFacade],
})
export class ProjectsModule {}
