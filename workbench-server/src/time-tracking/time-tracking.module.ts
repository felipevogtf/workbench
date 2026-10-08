import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TasksModule } from '@tasks/tasks.module';
import { TimeEntryOrmEntity } from './infrastructure/persistence/time-entry.orm-entity';
import { TimeEntriesController } from './infrastructure/http/time-entries.controller';
import { TimeEntriesService } from './application/time-entries.service';
import { TIME_ENTRY_REPOSITORY_PORT } from './domain/ports/time-entry-repository.port';
import { TypeOrmTimeEntryRepository } from './infrastructure/repositories/typeorm-time-entry.repository';
import { ISSUE_EXISTS_PORT } from './domain/ports/issue-exists.port';
import { TasksIssueExistsAdapter } from './infrastructure/adapters/tasks-issue-exists.adapter';
import { ISSUE_ORIGIN_PORT } from './domain/ports/issue-origin.port';
import { TasksIssueOriginAdapter } from './infrastructure/adapters/tasks-issue-origin.adapter';

@Module({
  imports: [TasksModule, TypeOrmModule.forFeature([TimeEntryOrmEntity])],
  controllers: [TimeEntriesController],
  providers: [
    TimeEntriesService,
    {
      provide: TIME_ENTRY_REPOSITORY_PORT,
      useClass: TypeOrmTimeEntryRepository,
    },
    { provide: ISSUE_EXISTS_PORT, useClass: TasksIssueExistsAdapter },
    { provide: ISSUE_ORIGIN_PORT, useClass: TasksIssueOriginAdapter },
  ],
  exports: [TIME_ENTRY_REPOSITORY_PORT, TimeEntriesService],
})
export class TimeTrackingModule {}
