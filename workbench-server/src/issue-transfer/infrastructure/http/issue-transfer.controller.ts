import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';
import { IssueTransferService } from '@issue-transfer/application/issue-transfer.service';
import { TransferIssueDto } from '@issue-transfer/dto/transfer-issue.dto';

@Controller('issues')
export class IssueTransferController {
  constructor(private readonly transferService: IssueTransferService) {}

  /** Traspasa horas y estado de una tarea local a otra de Plane y elimina la local. */
  @Post(':id/transfer')
  @HttpCode(200)
  async transfer(
    @Param('id') id: string,
    @Body() dto: TransferIssueDto,
  ): Promise<{ targetId: string; movedEntries: number }> {
    const movedEntries = await this.transferService.transfer(id, dto.targetId);
    return { targetId: dto.targetId, movedEntries };
  }
}
