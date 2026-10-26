import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Recipe } from '@recipes/domain/entities/recipe.entity';
import { RecipeRepositoryPort } from '@recipes/domain/ports/recipe-repository.port';
import { RecipeOrmEntity } from '@recipes/infrastructure/persistence/recipe.orm-entity';

@Injectable()
export class TypeOrmRecipeRepository implements RecipeRepositoryPort {
  constructor(
    @InjectRepository(RecipeOrmEntity)
    private readonly repository: Repository<RecipeOrmEntity>,
  ) {}

  async findAll(): Promise<Recipe[]> {
    return (await this.repository.find()).map((orm) => this.toDomain(orm));
  }

  async findById(id: string): Promise<Recipe | null> {
    const orm = await this.repository.findOne({ where: { id } });
    return orm ? this.toDomain(orm) : null;
  }

  async findByRepo(repo: string): Promise<Recipe | null> {
    const orm = await this.repository.findOne({ where: { repo } });
    return orm ? this.toDomain(orm) : null;
  }

  async save(recipe: Recipe): Promise<Recipe> {
    const saved = await this.repository.save({
      id: recipe.id,
      repo: recipe.repo,
      content: recipe.content,
      depends_on: [...recipe.dependsOn],
    });
    return this.toDomain(saved);
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete({ id });
  }

  private toDomain(orm: RecipeOrmEntity): Recipe {
    return Recipe.reconstruct({
      id: orm.id,
      repo: orm.repo,
      content: orm.content,
      dependsOn: orm.depends_on ?? [],
      createdAt: orm.created_at,
      updatedAt: orm.updated_at,
    });
  }
}
