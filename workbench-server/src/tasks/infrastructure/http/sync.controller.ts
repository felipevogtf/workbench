import { Controller, Post } from '@nestjs/common';
import {
  TasksSyncResult,
  TasksSyncService,
} from '@tasks/application/tasks-sync.service';

@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: TasksSyncService) {}

  // Proyectos y tareas de Plane, en un solo paso (lo mismo que hace el cron).
  @Post()
  sync(): Promise<TasksSyncResult> {
    return this.syncService.syncAll();
  }
}
