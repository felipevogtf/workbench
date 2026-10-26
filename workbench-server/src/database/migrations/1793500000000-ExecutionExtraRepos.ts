import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Una tarea puede tocar más de un repositorio: el primero sigue en `repo`, `branch` y compañía, y los
 * demás van en `extra_repos`, cada uno con su rama y su PR.
 */
export class ExecutionExtraRepos1793500000000 implements MigrationInterface {
  name = 'ExecutionExtraRepos1793500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "executions" ADD "extra_repos" jsonb NOT NULL DEFAULT '[]'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "executions" DROP COLUMN "extra_repos"`,
    );
  }
}
