import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import { Board } from '@kanban/domain/entities/board.entity';
import { BoardProps } from '@kanban/domain/entities/board.props';
import { BoardRepositoryPort } from '@kanban/domain/ports/board-repository.port';
import { BoardOrmEntity } from '@kanban/infrastructure/persistence/board.orm-entity';

@Injectable()
export class TypeOrmBoardRepository implements BoardRepositoryPort {
  constructor(
    @InjectRepository(BoardOrmEntity)
    private readonly boardRepository: Repository<BoardOrmEntity>,
  ) {}

  async findById(boardId: string): Promise<Board | null> {
    const boardOrmEntity = await this.boardRepository.findOne({
      where: { id: boardId },
    });

    return boardOrmEntity ? this.toDomain(boardOrmEntity) : null;
  }

  async findAll(): Promise<Board[]> {
    const boardOrmEntities = await this.boardRepository.find({
      order: { created_at: 'ASC' },
    });

    return boardOrmEntities.map((boardOrmEntity) =>
      this.toDomain(boardOrmEntity),
    );
  }

  async save(board: Board): Promise<void> {
    const boardOrmEntity = this.toOrm(board);
    await this.boardRepository.save(boardOrmEntity);
  }

  async delete(boardId: string): Promise<void> {
    await this.boardRepository.delete(boardId);
  }

  private toDomain(boardOrmEntity: BoardOrmEntity): Board {
    const props: BoardProps = {
      id: boardOrmEntity.id,
      name: boardOrmEntity.name,
      description: boardOrmEntity.description,
      createdAt: boardOrmEntity.created_at,
    };

    return Board.reconstruct(props);
  }

  private toOrm(board: Board): DeepPartial<BoardOrmEntity> {
    return {
      id: board.id,
      name: board.name,
      description: board.description,
    };
  }
}
