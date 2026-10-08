import { DomainError } from '@core/domain/domain.error';
import { insertAt, positionAt } from '@kanban/domain/column-order';
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
import { Inject, Injectable } from '@nestjs/common';

export interface AddIssueToBoardData {
  boardId: string;
  issueId: string;
}

export interface RemoveIssueFromBoardData {
  boardId: string;
  issueId: string;
}

export
@Injectable()
class BoardIssueService {
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
      throw DomainError.notFound(`Board with id ${data.boardId} not found`);
    }

    const issue = await this.tasksGateway.issueExists(data.issueId);

    if (!issue) {
      throw DomainError.notFound(`Issue with id ${data.issueId} not found`);
    }

    const issueInBoard = await this.boardIssueRepository.findByIssueId(
      data.issueId,
    );

    if (issueInBoard) {
      throw DomainError.conflict(
        `Issue with id ${data.issueId} is already in board with id ${issueInBoard.boardId}`,
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
      throw DomainError.notFound(`Board with id ${boardId} not found`);
    }

    return this.boardIssueRepository.findByBoardId(boardId);
  }

  async removeIssueFromBoard(data: RemoveIssueFromBoardData): Promise<void> {
    const board = await this.boardRepository.findById(data.boardId);

    if (!board) {
      throw DomainError.notFound(`Board with id ${data.boardId} not found`);
    }

    const issueInBoard = await this.boardIssueRepository.findByIssueId(
      data.issueId,
    );

    if (!issueInBoard) {
      throw DomainError.notFound(
        `Issue with id ${data.issueId} is not in board with id ${data.boardId}`,
      );
    }

    await this.boardIssueRepository.delete(issueInBoard.id);
  }

  /**
   * Pasa la tarjeta de una tarea a otra: la de destino queda en el mismo tablero, al final de la
   * columna de su estado. Si la de origen no está en ningún tablero no hace nada; si la de destino
   * ya está en uno, se queda donde está y solo se quita la tarjeta de origen.
   */
  async reassignIssue(fromIssueId: string, toIssueId: string): Promise<void> {
    const card = await this.boardIssueRepository.findByIssueId(fromIssueId);
    if (!card) return;

    const [target] = await this.tasksGateway.findIssueRefsByIds([toIssueId]);
    if (!target) {
      throw DomainError.notFound(`Issue with id ${toIssueId} not found`);
    }

    // Se quita primero para que la tarjeta de origen no cuente al calcular el lugar del destino.
    await this.boardIssueRepository.delete(card.id);
    if (await this.boardIssueRepository.findByIssueId(toIssueId)) return;

    await this.boardIssueRepository.save(
      BoardIssue.create({
        boardId: card.boardId,
        issueId: toIssueId,
        position: await this.nextPositionInColumn(card.boardId, target.stateId),
      }),
    );
  }

  // Mueve la tarjeta a una columna (estado) y a un lugar de ella, y renumera
  // la columna de destino para que el orden siempre quede bien definido.
  async moveIssue(
    boardId: string,
    issueId: string,
    { stateId, index }: { stateId?: string | null; index: number },
  ): Promise<void> {
    if (!Number.isInteger(index) || index < 0) {
      throw new DomainError('index must be an integer of 0 or more');
    }

    const boardIssue = await this.boardIssueRepository.findByIssueId(issueId);

    if (!boardIssue || boardIssue.boardId !== boardId) {
      throw DomainError.notFound(
        `Issue with id ${issueId} is not in board with id ${boardId}`,
      );
    }

    const boardIssues = await this.boardIssueRepository.findByBoardId(boardId);
    const refs = await this.tasksGateway.findIssueRefsByIds(
      boardIssues.map((item) => item.issueId),
    );
    const currentState = refs.find((ref) => ref.id === issueId);
    if (!currentState) {
      throw DomainError.notFound(`Issue with id ${issueId} not found`);
    }

    const targetState = stateId === undefined ? currentState.stateId : stateId;
    if (targetState !== currentState.stateId) {
      if (targetState !== null) {
        const stateExists = await this.tasksGateway.stateExists(targetState);
        if (!stateExists) {
          throw DomainError.notFound(`State with id ${targetState} not found`);
        }
      }
      await this.tasksGateway.setIssueState(issueId, targetState);
    }

    const stateByIssueId = new Map(refs.map((ref) => [ref.id, ref.stateId]));
    const column = boardIssues.filter(
      (item) =>
        item.id !== boardIssue.id &&
        (stateByIssueId.get(item.issueId) ?? null) === targetState,
    );

    const changed: BoardIssue[] = [];
    for (const [position, item] of insertAt(
      column,
      boardIssue,
      index,
    ).entries()) {
      const newPosition = positionAt(position);
      if (item.position !== newPosition) {
        item.reposition(newPosition);
        changed.push(item);
      }
    }
    await this.boardIssueRepository.saveMany(changed);
  }

  /**
   * Todas las tarjetas de todos los tableros. Las de tareas que ya no existen (se eliminaron o se
   * transfirieron) no cuentan: se descartan y se borran, para que los contadores no las muestren.
   */
  async listAll(): Promise<BoardIssue[]> {
    const cards = await this.boardIssueRepository.findAll();
    const refs = await this.tasksGateway.findIssueRefsByIds(
      cards.map((card) => card.issueId),
    );
    const existing = new Set(refs.map((ref) => ref.id));

    const alive: BoardIssue[] = [];
    for (const card of cards) {
      if (existing.has(card.issueId)) alive.push(card);
      else await this.boardIssueRepository.delete(card.id);
    }
    return alive;
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
