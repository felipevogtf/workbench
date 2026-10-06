import { BoardIssue } from '@kanban/domain/entities/board-issue.entity';
import {
  BOARD_ISSUE_REPOSITORY_PORT,
  type BoardIssueRepositoryPort,
} from '@kanban/domain/ports/board-issue-repository.port';
import {
  BOARD_REPOSITORY_PORT,
  type BoardRepositoryPort,
} from '@kanban/domain/ports/board-repository.port';
import {
  TASKS_GATEWAY_PORT,
  type TasksGatewayPort,
} from '@kanban/domain/ports/tasks-gateway.port';
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

export interface AddIssueToBoardData {
  boardId: string;
  issueId: string;
}

export interface RemoveIssueFromBoardData {
  boardId: string;
  issueId: string;
}

export interface MoveIssueInBoardData {
  boardId: string;
  issueId: string;
  newPosition: number;
}

@Injectable()
export class BoardIssueService {
  constructor(
    @Inject(BOARD_ISSUE_REPOSITORY_PORT)
    private readonly boardIssueRepository: BoardIssueRepositoryPort,
    @Inject(BOARD_REPOSITORY_PORT)
    private readonly boardRepository: BoardRepositoryPort,
    @Inject(TASKS_GATEWAY_PORT)
    private readonly tasksGateway: TasksGatewayPort,
  ) {}

  async addIssueToBoard(data: AddIssueToBoardData): Promise<BoardIssue> {
    const board = await this.boardRepository.findById(data.boardId);

    if (!board) {
      throw new NotFoundException(`Board with id ${data.boardId} not found`);
    }

    const issue = await this.tasksGateway.issueExists(data.issueId);

    if (!issue) {
      throw new NotFoundException(`Issue with id ${data.issueId} not found`);
    }

    const issueInBoard = await this.boardIssueRepository.findByIssueId(
      data.issueId,
    );

    if (issueInBoard) {
      throw new ConflictException(
        `Issue with id ${data.issueId} is already in board with id ${data.boardId}`,
      );
    }

    const [issueRef] = await this.tasksGateway.findIssueRefsByIds([
      data.issueId,
    ]);
    const position = await this.nextPositionInColumn(
      data.boardId,
      issueRef?.stateId ?? null,
    );

    const boardIssue = BoardIssue.create({
      boardId: data.boardId,
      issueId: data.issueId,
      position: position,
    });

    await this.boardIssueRepository.save(boardIssue);

    return boardIssue;
  }

  async listByBoard(boardId: string): Promise<BoardIssue[]> {
    const board = await this.boardRepository.findById(boardId);

    if (!board) {
      throw new NotFoundException(`Board with id ${boardId} not found`);
    }

    return this.boardIssueRepository.findByBoardId(boardId);
  }

  async removeIssueFromBoard(data: RemoveIssueFromBoardData): Promise<void> {
    const board = await this.boardRepository.findById(data.boardId);

    if (!board) {
      throw new NotFoundException(`Board with id ${data.boardId} not found`);
    }

    const issueInBoard = await this.boardIssueRepository.findByIssueId(
      data.issueId,
    );

    if (!issueInBoard) {
      throw new NotFoundException(
        `Issue with id ${data.issueId} is not in board with id ${data.boardId}`,
      );
    }

    await this.boardIssueRepository.delete(issueInBoard.id);
  }

  async moveIssue(
    boardId: string,
    issueId: string,
    { stateId, position }: { stateId: string | null; position: number },
  ): Promise<void> {
    const boardIssue = await this.boardIssueRepository.findByIssueId(issueId);

    if (!boardIssue || boardIssue.boardId !== boardId) {
      throw new NotFoundException(
        `Issue with id ${issueId} is not in board with id ${boardId}`,
      );
    }

    const [issueRef] = await this.tasksGateway.findIssueRefsByIds([issueId]);
    if (!issueRef) {
      throw new NotFoundException(`Issue with id ${issueId} not found`);
    }

    if (stateId !== issueRef.stateId) {
      if (stateId !== null) {
        const stateExists = await this.tasksGateway.stateExists(stateId);
        if (!stateExists) {
          throw new NotFoundException(`State with id ${stateId} not found`);
        }
      }
      await this.tasksGateway.setIssueState(issueId, stateId);
    }

    boardIssue.reposition(position);
    await this.boardIssueRepository.save(boardIssue);
  }

  private async nextPositionInColumn(
    boardId: string,
    stateId: string | null,
  ): Promise<number> {
    const boardIssues = await this.boardIssueRepository.findByBoardId(boardId);

    if (boardIssues.length === 0) {
      return 1000;
    }

    const issues = await this.tasksGateway.findIssueRefsByIds(
      boardIssues.map((boardIssue) => boardIssue.issueId),
    );

    const stateByIssueId = new Map(
      issues.map((issue) => [issue.id, issue.stateId]),
    );

    const positionsInColumn = boardIssues
      .filter(
        (boardIssue) => stateByIssueId.get(boardIssue.issueId) === stateId,
      )
      .map((boardIssue) => boardIssue.position);

    if (positionsInColumn.length === 0) {
      return 1000;
    }

    const maxPosition = Math.max(...positionsInColumn);
    return maxPosition + 1000;
  }
}
