import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * La receta pasa a ser un proyecto (ver docs/proyectos.md): la tabla `project_recipes` se llama `projects`
 * y gana nombre, rama principal, referencia al entorno del runner, reglas de arquitectura y comando de
 * verificación. Las recetas existentes quedan como proyectos con valores por defecto.
 */
export class ProjectsFromRecipes1795900000000 implements MigrationInterface {
  name = 'ProjectsFromRecipes1795900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "project_recipes" RENAME TO "projects"`);
    await queryRunner.query(
      `ALTER TABLE "projects" ADD "name" character varying NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" ADD "main_branch" character varying NOT NULL DEFAULT 'main'`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" ADD "runner_environment" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" ADD "architecture_rules" text NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" ADD "verify_command" character varying`,
    );
    // El nombre visible parte del nombre del repositorio.
    await queryRunner.query(
      `UPDATE "projects" SET "name" = split_part("repo", '/', 2)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "verify_command"`);
    await queryRunner.query(
      `ALTER TABLE "projects" DROP COLUMN "architecture_rules"`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" DROP COLUMN "runner_environment"`,
    );
    await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "main_branch"`);
    await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "name"`);
    await queryRunner.query(`ALTER TABLE "projects" RENAME TO "project_recipes"`);
  }
}
