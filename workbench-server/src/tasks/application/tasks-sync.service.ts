import { Injectable, Logger } from '@nestjs/common';
import { IssuesService } from '@tasks/application/issues.service';
import { ProjectsService } from '@tasks/application/projects.service';

export interface SyncCounts {
  created: number;
  updated: number;
}

export interface TasksSyncResult {
  projects: SyncCounts;
  issues: SyncCounts;
  // Proyectos cuyas tareas no se pudieron traer (el resto sigue su curso).
  failedProjects: { id: string; name: string; message: string }[];
}

@Injectable()
export class TasksSyncService {
  private readonly logger = new Logger(TasksSyncService.name);
  private running: Promise<TasksSyncResult> | null = null;

  constructor(
    private readonly projectsService: ProjectsService,
    private readonly issuesService: IssuesService,
  ) {}

  // Si ya hay un sync en curso (cron + botón al mismo tiempo), se reutiliza
  // en vez de lanzar otro que pise al primero.
  syncAll(): Promise<TasksSyncResult> {
    this.running ??= this.run().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async run(): Promise<TasksSyncResult> {
    const projects = await this.projectsService.syncProjects();
    const issues: SyncCounts = { created: 0, updated: 0 };
    const failedProjects: TasksSyncResult['failedProjects'] = [];

    for (const project of await this.projectsService.getAllProjects()) {
      if (!project.externalId) continue;
      try {
        const result = await this.issuesService.syncByProject(project.id);
        issues.created += result.created;
        issues.updated += result.updated;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Sync of "${project.name}" failed: ${message}`);
        failedProjects.push({ id: project.id, name: project.name, message });
      }
    }

    return { projects, issues, failedProjects };
  }
}
