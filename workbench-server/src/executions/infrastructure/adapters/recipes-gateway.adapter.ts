import { Injectable } from '@nestjs/common';
import { RecipesService } from '@recipes/application/recipes.service';
import { RecipesGatewayPort } from '@executions/domain/ports/gateways.port';

/** Único punto de la ejecución que conoce al módulo de recetas. */
@Injectable()
export class RecipesGatewayAdapter implements RecipesGatewayPort {
  constructor(private readonly recipes: RecipesService) {}

  contextFor(repos: readonly string[]): Promise<string | null> {
    return this.recipes.contextFor(repos);
  }
}
