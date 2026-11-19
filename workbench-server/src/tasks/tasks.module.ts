import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { IssueOrmEntity } from './infrastructure/persistence/issue.orm-entity';
import { TaskProjectOrmEntity } from './infrastructure/persistence/task-project.orm-entity';
import { StateOrmEntity } from './infrastructure/persistence/state.orm-entity';
import { LabelOrmEntity } from './infrastructure/persistence/label.orm-entity';
import { Module } from '@nestjs/common';
import { ISSUE_REPOSITORY_PORT } from './domain/ports/issue-repository.port';
import { TypeOrmLabelRepository } from './infrastructure/repositories/typeorm-label.repository';
import { LABEL_REPOSITORY_PORT } from './domain/ports/label-repository.port';
import { TypeOrmStateRepository } from './infrastructure/repositories/typeorm-state.repository';
import { STATE_REPOSITORY_PORT } from './domain/ports/state-repository.port';
import { TypeOrmTaskProjectRepository } from './infrastructure/repositories/typeorm-task-project.repository';
import { TASK_PROJECT_REPOSITORY_PORT } from './domain/ports/task-project-repository.port';
import { PlaneApiAdapter } from './infrastructure/adapters/plane-api.adapter';
import { PlaneApiClient } from './infrastructure/clients/plane-api.client';
import { ISSUE_SOURCE_PORT } from './domain/ports/issue-source.port';
import { TypeOrmIssueRepository } from './infrastructure/repositories/typeorm-issue.repository';
import { IssuesService } from './application/issues.service';
import { PROJECT_SOURCE_PORT } from './domain/ports/project-source.port';
import { TaskProjectsService } from './application/task-projects.service';
import { TaskProjectsController } from './infrastructure/http/task-projects.controller';
import { IssuesController } from './infrastructure/http/issues.controller';
import { StatesService } from './application/states.service';
import { StatesController } from './infrastructure/http/states.controller';
import { LabelsController } from './infrastructure/http/labels.controller';
import { LabelsService } from './application/labels.service';
import { TICKET_SOURCE_PORT } from './domain/ports/ticket-source.port';
import { TasksSyncService } from './application/tasks-sync.service';
import { SyncController } from './infrastructure/http/sync.controller';
import { TasksSyncScheduler } from './infrastructure/scheduling/tasks-sync.scheduler';
import { TasksFacade } from './application/tasks-facade.service';
import { TicketLookupService } from './application/ticket-lookup.service';
import { IssueGroupMemberOrmEntity } from './infrastructure/persistence/issue-group-member.orm-entity';
import { ISSUE_GROUP_REPOSITORY_PORT } from './domain/ports/issue-group-repository.port';
import { TypeOrmIssueGroupRepository } from './infrastructure/repositories/typeorm-issue-group.repository';
import { IssueGroupsService } from './application/issue-groups.service';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([
      IssueOrmEntity,
      TaskProjectOrmEntity,
      StateOrmEntity,
      LabelOrmEntity,
      IssueGroupMemberOrmEntity,
    ]),
  ],
  providers: [
    PlaneApiClient,
    PlaneApiAdapter,
    { provide: PROJECT_SOURCE_PORT, useExisting: PlaneApiAdapter },
    { provide: ISSUE_SOURCE_PORT, useExisting: PlaneApiAdapter },
    { provide: TICKET_SOURCE_PORT, useExisting: PlaneApiAdapter },
    { provide: ISSUE_REPOSITORY_PORT, useClass: TypeOrmIssueRepository },
    {
      provide: TASK_PROJECT_REPOSITORY_PORT,
      useClass: TypeOrmTaskProjectRepository,
    },
    { provide: STATE_REPOSITORY_PORT, useClass: TypeOrmStateRepository },
    { provide: LABEL_REPOSITORY_PORT, useClass: TypeOrmLabelRepository },
    {
      provide: ISSUE_GROUP_REPOSITORY_PORT,
      useClass: TypeOrmIssueGroupRepository,
    },
    IssueGroupsService,
    IssuesService,
    TaskProjectsService,
    StatesService,
    LabelsService,
    TicketLookupService,
    TasksFacade,
    TasksSyncService,
    TasksSyncScheduler,
  ],
  // Lo único que ven los demás módulos: la fachada y la consulta de tickets de Plane.
  exports: [TasksFacade, TicketLookupService, IssueGroupsService],
  controllers: [
    TaskProjectsController,
    IssuesController,
    StatesController,
    LabelsController,
    SyncController,
  ],
})
export class TasksModule {}
