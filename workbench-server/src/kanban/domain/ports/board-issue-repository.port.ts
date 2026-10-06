import { BoardIssue } from '@kanban/domain/entities/board-issue.entity';

export interface BoardIssueRepositoryPort {
  findById(id: string): Promise<BoardIssue | null>;
  findAll(): Promise<BoardIssue[]>;
  findByBoardId(boardId: string): Promise<BoardIssue[]>;
  findByIssueId(issueId: string): Promise<BoardIssue | null>;
  save(boardIssue: BoardIssue): Promise<void>;
  saveMany(boardIssues: BoardIssue[]): Promise<void>;
  delete(id: string): Promise<void>;
  deleteByBoardId(boardId: string): Promise<void>;
}

export const BOARD_ISSUE_REPOSITORY_PORT = Symbol('BoardIssueRepositoryPort');
