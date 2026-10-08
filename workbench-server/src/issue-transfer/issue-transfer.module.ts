import { Module } from '@nestjs/common';
import { TasksModule } from '@tasks/tasks.module';
import { TimeTrackingModule } from '@time-tracking/time-tracking.module';
import { IssueTransferService } from './application/issue-transfer.service';
import { IssueTransferController } from './infrastructure/http/issue-transfer.controller';

@Module({
  imports: [TasksModule, TimeTrackingModule],
  controllers: [IssueTransferController],
  providers: [IssueTransferService],
})
export class IssueTransferModule {}
