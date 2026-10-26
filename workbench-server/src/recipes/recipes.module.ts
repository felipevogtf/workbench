import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecipesService } from './application/recipes.service';
import { RECIPE_REPOSITORY_PORT } from './domain/ports/recipe-repository.port';
import { RecipesController } from './infrastructure/http/recipes.controller';
import { RecipeOrmEntity } from './infrastructure/persistence/recipe.orm-entity';
import { TypeOrmRecipeRepository } from './infrastructure/repositories/typeorm-recipe.repository';

@Module({
  imports: [TypeOrmModule.forFeature([RecipeOrmEntity])],
  controllers: [RecipesController],
  providers: [
    RecipesService,
    { provide: RECIPE_REPOSITORY_PORT, useClass: TypeOrmRecipeRepository },
  ],
  exports: [RecipesService],
})
export class RecipesModule {}
