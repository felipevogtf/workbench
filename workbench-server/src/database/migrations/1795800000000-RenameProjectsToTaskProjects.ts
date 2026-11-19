import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * «Proyecto» pasa a ser el repositorio (ver docs/proyectos.md); el de Plane, donde viven los tickets,
 * se llama proyecto de tareas. Solo cambia el nombre de la tabla: las claves foráneas la siguen solas.
 */
export class RenameProjectsToTaskProjects1795800000000 implements MigrationInterface {
  name = 'RenameProjectsToTaskProjects1795800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "projects" RENAME TO "task_projects"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "task_projects" RENAME TO "projects"`);
  }
}
