import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { BoardService } from '@kanban/application/board.service';
import { BoardIssueService } from '@kanban/application/board-issue.service';
import { Board } from '@kanban/domain/entities/board.entity';
import { BoardIssue } from '@kanban/domain/entities/board-issue.entity';
import { CreateBoardDto } from '@kanban/dto/create-board.dto';
import { UpdateBoardDto } from '@kanban/dto/update-board.dto';
import { BoardResponseDto } from '@kanban/dto/board-response.dto';
import { AddIssueToBoardDto } from '@kanban/dto/add-issue-to-board.dto';
import { MoveIssueDto } from '@kanban/dto/move-issue.dto';
import { BoardIssueResponseDto } from '@kanban/dto/board-issue-response.dto';

@Controller('boards')
export class BoardController {
  constructor(
    private readonly boardService: BoardService,
    private readonly boardIssueService: BoardIssueService,
  ) {}

  @Post()
  async create(
    @Body() createBoardDto: CreateBoardDto,
  ): Promise<BoardResponseDto> {
    const board = await this.boardService.createBoard(createBoardDto);
    return this.toResponseDto(board);
  }

  @Get()
  async findAll(): Promise<BoardResponseDto[]> {
    const boards = await this.boardService.listBoards();
    return boards.map((board) => this.toResponseDto(board));
  }

  @Get(':id')
  async findById(@Param('id') id: string): Promise<BoardResponseDto> {
    const board = await this.boardService.getBoard(id);
    return this.toResponseDto(board);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateBoardDto: UpdateBoardDto,
  ): Promise<BoardResponseDto> {
    const board = await this.boardService.updateBoard(id, updateBoardDto);
    return this.toResponseDto(board);
  }

  @Delete(':id')
  async delete(@Param('id') id: string): Promise<void> {
    await this.boardService.deleteBoard(id);
  }

  @Get(':id/issues')
  async findIssues(@Param('id') id: string): Promise<BoardIssueResponseDto[]> {
    const boardIssues = await this.boardIssueService.listByBoard(id);
    return boardIssues.map((boardIssue) => this.toBoardIssueDto(boardIssue));
  }

  @Post(':id/issues')
  async addIssue(
    @Param('id') id: string,
    @Body() addIssueToBoardDto: AddIssueToBoardDto,
  ): Promise<BoardIssueResponseDto> {
    const boardIssue = await this.boardIssueService.addIssueToBoard({
      boardId: id,
      issueId: addIssueToBoardDto.issueId,
    });
    return this.toBoardIssueDto(boardIssue);
  }

  @Delete(':id/issues/:issueId')
  async removeIssue(
    @Param('id') id: string,
    @Param('issueId') issueId: string,
  ): Promise<void> {
    await this.boardIssueService.removeIssueFromBoard({
      boardId: id,
      issueId,
    });
  }

  @Patch(':id/issues/:issueId/move')
  async moveIssue(
    @Param('id') id: string,
    @Param('issueId') issueId: string,
    @Body() moveIssueDto: MoveIssueDto,
  ): Promise<void> {
    await this.boardIssueService.moveIssue(id, issueId, {
      stateId: moveIssueDto.stateId,
      position: moveIssueDto.position,
    });
  }

  private toResponseDto(board: Board): BoardResponseDto {
    return {
      id: board.id,
      name: board.name,
      description: board.description,
      createdAt: board.createdAt.toISOString(),
    };
  }

  private toBoardIssueDto(boardIssue: BoardIssue): BoardIssueResponseDto {
    return {
      id: boardIssue.id,
      boardId: boardIssue.boardId,
      issueId: boardIssue.issueId,
      position: boardIssue.position,
      createdAt: boardIssue.createdAt.toISOString(),
    };
  }
}
