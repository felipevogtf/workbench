import { Board } from '@kanban/domain/entities/board.entity';

export interface BoardRepositoryPort {
  findById(boardId: string): Promise<Board | null>;
  findAll(): Promise<Board[]>;
  save(board: Board): Promise<void>;
  delete(boardId: string): Promise<void>;
}

export const BOARD_REPOSITORY_PORT = Symbol('BoardRepositoryPort');
