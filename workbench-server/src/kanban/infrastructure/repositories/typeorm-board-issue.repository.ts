import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import { BoardIssue } from '@kanban/domain/entities/board-issue.entity';
import { BoardIssueProps } from '@kanban/domain/entities/board-issue.props';
import { BoardIssueRepositoryPort } from '@kanban/domain/ports/board-issue-repository.port';
import { BoardIssueOrmEntity } from '@kanban/infrastructure/persistence/board-issue.orm-entity';

@Injectable()
export class TypeOrmBoardIssueRepository implements BoardIssueRepositoryPort {
  constructor(
    @InjectRepository(BoardIssueOrmEntity)
    private readonly boardIssueRepository: Repository<BoardIssueOrmEntity>,
  ) {}

  async findById(id: string): Promise<BoardIssue | null> {
    const boardIssueOrmEntity = await this.boardIssueRepository.findOne({
      where: { id },
    });

    return boardIssueOrmEntity ? this.toDomain(boardIssueOrmEntity) : null;
  }

  async findByBoardId(boardId: string): Promise<BoardIssue[]> {
    const boardIssueOrmEntities = await this.boardIssueRepository.find({
      where: { board_id: boardId },
      order: { position: 'ASC' },
    });

    return boardIssueOrmEntities.map((boardIssueOrmEntity) =>
      this.toDomain(boardIssueOrmEntity),
    );
  }

  async findByIssueId(issueId: string): Promise<BoardIssue | null> {
    const boardIssueOrmEntity = await this.boardIssueRepository.findOne({
      where: { issue_id: issueId },
    });

    return boardIssueOrmEntity ? this.toDomain(boardIssueOrmEntity) : null;
  }

  // NOTA: el puerto declara este método como (boardId, issueId), pero
  // "posición en columna" no puede calcularse aquí porque board_issues no
  // guarda el estado (la columna vive en tasks.issues.state_id). Este
  // método queda como "siguiente posición en el board completo"; hoy no lo
  // llama nadie porque board-issue.service.ts reimplementa la lógica de
  // columna a mano. Ver aviso en el resumen de la revisión.
  async nextPositionInColumn(boardId: string): Promise<number> {
    const result = await this.boardIssueRepository
      .createQueryBuilder('board_issue')
      .select('MAX(board_issue.position)', 'max')
      .where('board_issue.board_id = :boardId', { boardId })
      .getRawOne<{ max: number | null }>();

    return (result?.max ?? 0) + 1000;
  }

  async save(boardIssue: BoardIssue): Promise<void> {
    const boardIssueOrmEntity = this.toOrm(boardIssue);
    await this.boardIssueRepository.save(boardIssueOrmEntity);
  }

  async delete(id: string): Promise<void> {
    await this.boardIssueRepository.delete(id);
  }

  async deleteByBoardId(boardId: string): Promise<void> {
    await this.boardIssueRepository.delete({ board_id: boardId });
  }

  private toDomain(boardIssueOrmEntity: BoardIssueOrmEntity): BoardIssue {
    const props: BoardIssueProps = {
      id: boardIssueOrmEntity.id,
      boardId: boardIssueOrmEntity.board_id,
      issueId: boardIssueOrmEntity.issue_id,
      position: boardIssueOrmEntity.position,
      createdAt: boardIssueOrmEntity.created_at,
    };

    return BoardIssue.reconstruct(props);
  }

  private toOrm(boardIssue: BoardIssue): DeepPartial<BoardIssueOrmEntity> {
    return {
      id: boardIssue.id,
      board_id: boardIssue.boardId,
      issue_id: boardIssue.issueId,
      position: boardIssue.position,
    };
  }
}
