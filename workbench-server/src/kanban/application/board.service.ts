import { Board } from '@kanban/domain/entities/board.entity';
import {
  BOARD_REPOSITORY_PORT,
  type BoardRepositoryPort,
} from '@kanban/domain/ports/board-repository.port';
import {
  BOARD_ISSUE_REPOSITORY_PORT,
  type BoardIssueRepositoryPort,
} from '@kanban/domain/ports/board-issue-repository.port';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';

interface CreateBoardData {
  name: string;
  description?: string | null;
}

@Injectable()
export class BoardService {
  constructor(
    @Inject(BOARD_REPOSITORY_PORT)
    private readonly boardRepository: BoardRepositoryPort,
    @Inject(BOARD_ISSUE_REPOSITORY_PORT)
    private readonly boardIssueRepository: BoardIssueRepositoryPort,
  ) {}

  async createBoard(data: CreateBoardData): Promise<Board> {
    const board = Board.create({
      name: data.name,
      description: data.description || null,
    });

    await this.boardRepository.save(board);
    return board;
  }

  async updateBoard(
    id: string,
    data: Partial<CreateBoardData>,
  ): Promise<Board> {
    const board = await this.boardRepository.findById(id);

    if (!board) {
      throw new NotFoundException(`Board with id ${id} not found`);
    }

    if (data.name !== undefined) {
      board.rename(data.name);
    }

    if (data.description !== undefined) {
      board.updateDescription(data.description);
    }

    await this.boardRepository.save(board);
    return board;
  }

  async deleteBoard(id: string): Promise<void> {
    const board = await this.boardRepository.findById(id);

    if (!board) {
      throw new NotFoundException(`Board with id ${id} not found`);
    }

    // Sin esto las tarjetas quedarían huérfanas y, como una tarea solo puede
    // estar en un tablero, no se podrían asignar a otro.
    await this.boardIssueRepository.deleteByBoardId(id);
    await this.boardRepository.delete(id);
  }

  async getBoard(id: string): Promise<Board> {
    const board = await this.boardRepository.findById(id);

    if (!board) {
      throw new NotFoundException(`Board with id ${id} not found`);
    }

    return board;
  }

  async listBoards(): Promise<Board[]> {
    return await this.boardRepository.findAll();
  }
}
