import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { TasksModule } from '@tasks/tasks.module';
import { BoardController } from './infrastructure/http/board.controller';
import { BoardOrmEntity } from './infrastructure/persistence/board.orm-entity';
import { BoardIssueOrmEntity } from './infrastructure/persistence/board-issue.orm-entity';
import { TypeOrmBoardRepository } from './infrastructure/repositories/typeorm-board.repository';
import { TypeOrmBoardIssueRepository } from './infrastructure/repositories/typeorm-board-issue.repository';
import { BOARD_REPOSITORY_PORT } from './domain/ports/board-repository.port';
import { BOARD_ISSUE_REPOSITORY_PORT } from './domain/ports/board-issue-repository.port';
import { BoardService } from './application/board.service';
import { BoardIssueService } from './application/board-issue.service';
import { TASKS_GATEWAY_PORT } from './domain/ports/tasks-gateway.port';
import { TasksGatewayAdapter } from './infrastructure/adapters/tasks-gateway.adapter';

@Module({
  imports: [
    TasksModule,
    TypeOrmModule.forFeature([BoardOrmEntity, BoardIssueOrmEntity]),
  ],
  providers: [
    { provide: BOARD_REPOSITORY_PORT, useClass: TypeOrmBoardRepository },
    {
      provide: BOARD_ISSUE_REPOSITORY_PORT,
      useClass: TypeOrmBoardIssueRepository,
    },
    { provide: TASKS_GATEWAY_PORT, useClass: TasksGatewayAdapter },
    BoardService,
    BoardIssueService,
  ],
  exports: [BOARD_REPOSITORY_PORT, BOARD_ISSUE_REPOSITORY_PORT],
  controllers: [BoardController],
})
export class KanbanModule {}
