import { Injectable } from '@nestjs/common';
import { ProjectsFacade } from '@projects/application/projects-facade.service';
import { RecipesGatewayPort } from '@executions/domain/ports/gateways.port';

/** Único punto de la ejecución que conoce al módulo de proyectos. */
@Injectable()
export class RecipesGatewayAdapter implements RecipesGatewayPort {
  constructor(private readonly projects: ProjectsFacade) {}

  contextFor(repos: readonly string[]): Promise<string | null> {
    return this.projects.contextFor(repos);
  }

  async verifyOf(repo: string): Promise<string | null> {
    return (await this.projects.findByRepo(repo))?.verifyCommand ?? null;
  }
}
