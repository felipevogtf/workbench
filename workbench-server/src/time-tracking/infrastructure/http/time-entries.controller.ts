import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { TimeEntriesService } from '@time-tracking/application/time-entries.service';
import { TimeEntry } from '@time-tracking/domain/entities/time-entry.entity';
import { TimeEntryResponseDto } from '@time-tracking/dto/time-entry-response.dto';
import { CreateTimeEntryDto } from '@time-tracking/dto/create-time-entry.dto';

@Controller('time-entries')
export class TimeEntriesController {
  constructor(private readonly timeEntriesService: TimeEntriesService) {}

  @Post()
  async addTimeEntry(
    @Body() createTimeEntryDto: CreateTimeEntryDto,
  ): Promise<TimeEntryResponseDto> {
    const timeEntry =
      await this.timeEntriesService.addTimeEntry(createTimeEntryDto);
    return this.toDto(timeEntry);
  }

  @Get('issue/:issueId')
  async findByIssue(
    @Param('issueId') issueId: string,
  ): Promise<TimeEntryResponseDto[]> {
    const timeEntries = await this.timeEntriesService.findByIssue(issueId);
    return timeEntries.map((entry) => this.toDto(entry));
  }

  @Get('issue/:issueId/total-hours')
  async getTotalHoursByIssue(@Param('issueId') issueId: string) {
    const totalHours =
      await this.timeEntriesService.getTotalHoursByIssue(issueId);
    return { issueId, totalHours };
  }

  @Delete(':id')
  async deleteTimeEntry(@Param('id') id: string) {
    await this.timeEntriesService.deleteTimeEntry(id);
  }

  private toDto(timeEntry: TimeEntry): TimeEntryResponseDto {
    return {
      id: timeEntry.id,
      issueId: timeEntry.issueId,
      hours: timeEntry.hours,
      date: timeEntry.date,
    };
  }
}
