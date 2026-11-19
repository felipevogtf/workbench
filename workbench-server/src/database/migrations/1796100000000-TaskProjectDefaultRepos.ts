import { MigrationInterface, QueryRunner } from 'typeorm';

/** Los proyectos (repositorios) por defecto de un proyecto de tareas: las tareas que no tienen los suyos usan estos. */
export class TaskProjectDefaultRepos1796100000000 implements MigrationInterface {
  name = 'TaskProjectDefaultRepos1796100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "task_projects" ADD "default_project_repos" jsonb NOT NULL DEFAULT '[]'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "task_projects" DROP COLUMN "default_project_repos"`,
    );
  }
}
