import { MigrationInterface, QueryRunner } from 'typeorm';

const TOOL = 'Bash(git rm:*)';

/**
 * Un desarrollador debe poder quitar un archivo que el revisor marca como sobrante (uno de prueba que quedó en el commit): `git rm`
 * solo toca archivos de su carpeta de trabajo aislada. Sin esto la ejecución se atasca: el revisor pide quitarlo y el desarrollador no
 * puede. Se suma a todos los desarrolladores que todavía no lo tengan.
 */
export class DeveloperGitRm1794400000000 implements MigrationInterface {
  name = 'DeveloperGitRm1794400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "agents" SET "allowed_tools" = array_append("allowed_tools", $1)
        WHERE "module" = 'task-developer' AND NOT ($1 = ANY("allowed_tools"))`,
      [TOOL],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "agents" SET "allowed_tools" = array_remove("allowed_tools", $1)
        WHERE "module" = 'task-developer'`,
      [TOOL],
    );
  }
}
