import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Recetas de proyectos: un texto por repositorio que explica cómo se levanta y se prueba, y de qué otros
 * repositorios depende, para dárselo a los agentes de la ejecución.
 */
export class ProjectRecipes1794000000000 implements MigrationInterface {
  name = 'ProjectRecipes1794000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "project_recipes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "repo" character varying NOT NULL, "content" text NOT NULL DEFAULT '', "depends_on" jsonb NOT NULL DEFAULT '[]', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_project_recipes_repo" UNIQUE ("repo"), CONSTRAINT "PK_project_recipes_id" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "project_recipes"`);
  }
}
