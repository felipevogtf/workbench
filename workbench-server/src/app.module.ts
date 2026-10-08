import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TasksModule } from '@tasks/tasks.module';
import { CoreModule } from './core/core.module';
import { TimeTrackingModule } from '@time-tracking/time-tracking.module';
import { KanbanModule } from '@kanban/kanban.module';
import { AiAgentsModule } from '@ai-agents/ai-agents.module';
import { PrReviewModule } from '@pr-review/pr-review.module';
import { PlannerModule } from '@planner/planner.module';
import { IssueTransferModule } from '@issue-transfer/issue-transfer.module';

@Module({
  imports: [
    CoreModule,
    TasksModule,
    TimeTrackingModule,
    KanbanModule,
    AiAgentsModule,
    PrReviewModule,
    PlannerModule,
    IssueTransferModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
