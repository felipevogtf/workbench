import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { IssueOrmEntity } from './infrastructure/persistence/issue.orm-entity';
import { ProjectOrmEntity } from './infrastructure/persistence/project.orm-entity';
import { StateOrmEntity } from './infrastructure/persistence/state.orm-entity';
import { LabelOrmEntity } from './infrastructure/persistence/label.orm-entity';
import { Module } from '@nestjs/common';
import { ISSUE_REPOSITORY_PORT } from './domain/ports/issue-repository.port';
import { TypeOrmLabelRepository } from './infrastructure/repositories/typeorm-label.repository';
import { LABEL_REPOSITORY_PORT } from './domain/ports/label-repository.port';
import { TypeOrmStateRepository } from './infrastructure/repositories/typeorm-state.repository';
import { STATE_REPOSITORY_PORT } from './domain/ports/state-repository.port';
import { TypeOrmProjectRepository } from './infrastructure/repositories/typeorm-project.repository';
import { PROJECT_REPOSITORY_PORT } from './domain/ports/project-repository.port';
import { PlaneApiAdapter } from './infrastructure/adapters/plane-api.adapter';
import { PlaneApiClient } from './infrastructure/clients/plane-api.client';
import { ISSUE_SOURCE_PORT } from './domain/ports/issue-source.port';
import { TypeOrmIssueRepository } from './infrastructure/repositories/typeorm-issue.repository';
import { IssuesService } from './application/issues.service';
import { PROJECT_SOURCE_PORT } from './domain/ports/project-source.port';
import { ProjectsService } from './application/projects.service';
import { ProjectsController } from './infrastructure/http/projects.controller';
import { IssuesController } from './infrastructure/http/issues.controller';
import { StatesService } from './application/states.service';
import { StatesController } from './infrastructure/http/states.controller';
import { LabelsController } from './infrastructure/http/labels.controller';
import { LabelsService } from './application/labels.service';
import { TICKET_SOURCE_PORT } from './domain/ports/ticket-source.port';
import { TasksSyncService } from './application/tasks-sync.service';
import { SyncController } from './infrastructure/http/sync.controller';
import { TasksSyncScheduler } from './infrastructure/scheduling/tasks-sync.scheduler';
import { TicketLookupService } from './application/ticket-lookup.service';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([
      IssueOrmEntity,
      ProjectOrmEntity,
      StateOrmEntity,
      LabelOrmEntity,
    ]),
  ],
  providers: [
    PlaneApiClient,
    PlaneApiAdapter,
    { provide: PROJECT_SOURCE_PORT, useExisting: PlaneApiAdapter },
    { provide: ISSUE_SOURCE_PORT, useExisting: PlaneApiAdapter },
    { provide: TICKET_SOURCE_PORT, useExisting: PlaneApiAdapter },
    { provide: ISSUE_REPOSITORY_PORT, useClass: TypeOrmIssueRepository },
    { provide: PROJECT_REPOSITORY_PORT, useClass: TypeOrmProjectRepository },
    { provide: STATE_REPOSITORY_PORT, useClass: TypeOrmStateRepository },
    { provide: LABEL_REPOSITORY_PORT, useClass: TypeOrmLabelRepository },
    IssuesService,
    ProjectsService,
    StatesService,
    LabelsService,
    TicketLookupService,
    TasksSyncService,
    TasksSyncScheduler,
  ],
  exports: [
    ISSUE_REPOSITORY_PORT,
    PROJECT_REPOSITORY_PORT,
    STATE_REPOSITORY_PORT,
    LABEL_REPOSITORY_PORT,
    TicketLookupService,
  ],
  controllers: [
    ProjectsController,
    IssuesController,
    StatesController,
    LabelsController,
    SyncController,
  ],
})
export class TasksModule {}
