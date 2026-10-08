import { DomainError } from '@core/domain/domain.error';
import { BoardIssueService } from '@kanban/application/board-issue.service';
import { Injectable } from '@nestjs/common';
import { TasksFacade } from '@tasks/application/tasks-facade.service';
import { TimeEntriesService } from '@time-tracking/application/time-entries.service';

/**
 * Traspasa una tarea local a una tarea de Plane: las horas registradas, el estado y el lugar en el
 * tablero pasan a la de destino y la local se elimina. Orquesta `tasks`, `time-tracking` y `kanban`
 * sin que se conozcan entre sí.
 */
@Injectable()
export class IssueTransferService {
  constructor(
    private readonly tasks: TasksFacade,
    private readonly timeEntries: TimeEntriesService,
    private readonly boards: BoardIssueService,
  ) {}

  /** Devuelve cuántos registros de horas se movieron. */
  async transfer(sourceId: string, targetId: string): Promise<number> {
    if (sourceId === targetId) {
      throw new DomainError('Cannot transfer an issue to itself');
    }
    const source = await this.tasks.findIssue(sourceId);
    if (!source) {
      throw DomainError.notFound(`Issue with id ${sourceId} not found`);
    }
    if (!source.isLocal) {
      throw new DomainError('Only local issues can be transferred');
    }
    const target = await this.tasks.findIssue(targetId);
    if (!target) {
      throw DomainError.notFound(`Issue with id ${targetId} not found`);
    }
    if (target.isLocal) {
      throw new DomainError(
        'The target must be an issue that comes from Plane',
      );
    }

    // Primero lo que puede fallar y es reversible; la local se borra solo al final, cuando ya no
    // queda nada por traspasar. Si algo falla antes, la local sigue intacta y se puede reintentar.
    // Sin estado en la local, la de destino conserva el suyo.
    if (source.stateId !== null) {
      await this.tasks.setIssueState(targetId, source.stateId);
    }
    const moved = await this.timeEntries.moveEntries(sourceId, targetId);
    // Va después del estado: la tarjeta cae en la columna del estado ya traspasado.
    await this.boards.reassignIssue(sourceId, targetId);
    await this.tasks.deleteIssue(sourceId);
    return moved;
  }
}
