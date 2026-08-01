import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TimeEntryOrmEntity } from './infrastructure/persistence/time-entry.orm-entity';
import { TimeEntriesController } from './time-entries.controller';
import { TimeEntriesService } from './application/time-entries.service';
import { TIME_ENTRY_REPOSITORY_PORT } from './domain/ports/time-entry-repository.port';
import { TypeOrmTimeEntryRepository } from './infrastructure/repositories/typeorm-time-entry.repository';

@Module({
  imports: [TypeOrmModule.forFeature([TimeEntryOrmEntity])],
  controllers: [TimeEntriesController],
  providers: [
    TimeEntriesService,
    {
      provide: TIME_ENTRY_REPOSITORY_PORT,
      useClass: TypeOrmTimeEntryRepository,
    },
  ],
  exports: [TIME_ENTRY_REPOSITORY_PORT, TimeEntriesService],
})
export class TimeTrackingModule {}
