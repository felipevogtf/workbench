import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TasksModule } from '@tasks/tasks.module';
import { CoreModule } from './core/core.module';
import { ChatAttachmentsModule } from '@core/attachments/chat-attachments.module';
import { TimeTrackingModule } from '@time-tracking/time-tracking.module';
import { KanbanModule } from '@kanban/kanban.module';
import { AiAgentsModule } from '@ai-agents/ai-agents.module';
import { PrReviewModule } from '@pr-review/pr-review.module';
import { PlannerModule } from '@planner/planner.module';
import { ExecutionsModule } from '@executions/executions.module';
import { CredentialsModule } from '@credentials/credentials.module';
import { RecipesModule } from '@recipes/recipes.module';
import { IssueTransferModule } from '@issue-transfer/issue-transfer.module';
import { OrganizerModule } from '@organizer/organizer.module';

@Module({
  imports: [
    CoreModule,
    ChatAttachmentsModule,
    TasksModule,
    TimeTrackingModule,
    KanbanModule,
    AiAgentsModule,
    PrReviewModule,
    PlannerModule,
    ExecutionsModule,
    OrganizerModule,
    IssueTransferModule,
    CredentialsModule,
    RecipesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
