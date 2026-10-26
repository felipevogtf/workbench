import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TasksModule } from '@tasks/tasks.module';
import { RecipesService } from './application/recipes.service';
import { RECIPE_REPOSITORY_PORT } from './domain/ports/recipe-repository.port';
import { REPOSITORY_OPTIONS_PORT } from './domain/ports/repository-options.port';
import { TasksRepositoryOptionsAdapter } from './infrastructure/adapters/tasks-repository-options.adapter';
import { RecipesController } from './infrastructure/http/recipes.controller';
import { RecipeOrmEntity } from './infrastructure/persistence/recipe.orm-entity';
import { TypeOrmRecipeRepository } from './infrastructure/repositories/typeorm-recipe.repository';

@Module({
  imports: [TypeOrmModule.forFeature([RecipeOrmEntity]), TasksModule],
  controllers: [RecipesController],
  providers: [
    RecipesService,
    { provide: RECIPE_REPOSITORY_PORT, useClass: TypeOrmRecipeRepository },
    {
      provide: REPOSITORY_OPTIONS_PORT,
      useClass: TasksRepositoryOptionsAdapter,
    },
  ],
  exports: [RecipesService],
})
export class RecipesModule {}
