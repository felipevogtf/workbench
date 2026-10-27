import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import {
  OrganizerService,
  SessionDetail,
  SessionSummary,
} from '@organizer/application/organizer.service';
import {
  CreateSessionDto,
  SessionDetailDto,
  SessionSummaryDto,
  SetMembersDto,
  UpdateSessionDto,
} from '@organizer/dto/organizer.dto';

@Controller('organizer/sessions')
export class OrganizerController {
  constructor(private readonly organizer: OrganizerService) {}

  @Get()
  async list(): Promise<SessionSummaryDto[]> {
    return (await this.organizer.list()).map((entry) => this.toSummary(entry));
  }

  @Post()
  async create(@Body() dto: CreateSessionDto): Promise<SessionDetailDto> {
    return this.toDetail(await this.organizer.create(dto));
  }

  @Get(':id')
  async findById(@Param('id') id: string): Promise<SessionDetailDto> {
    return this.toDetail(await this.organizer.get(id));
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateSessionDto,
  ): Promise<SessionDetailDto> {
    return this.toDetail(await this.organizer.update(id, dto));
  }

  /** Las tareas del grupo, exactamente estas y en este orden. */
  @Put(':id/members')
  async setMembers(
    @Param('id') id: string,
    @Body() dto: SetMembersDto,
  ): Promise<SessionDetailDto> {
    return this.toDetail(await this.organizer.setMembers(id, dto.issueIds));
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string): Promise<void> {
    await this.organizer.remove(id);
  }

  private toSummary({
    session,
    memberCount,
  }: SessionSummary): SessionSummaryDto {
    return {
      id: session.id,
      title: session.title,
      groupIssueId: session.groupIssueId,
      memberCount,
      createdAt: session.createdAt.toISOString(),
    };
  }

  private toDetail({ session, group }: SessionDetail): SessionDetailDto {
    return {
      id: session.id,
      title: session.title,
      groupIssueId: session.groupIssueId,
      notes: group.notes,
      members: group.members,
      createdAt: session.createdAt.toISOString(),
    };
  }
}
