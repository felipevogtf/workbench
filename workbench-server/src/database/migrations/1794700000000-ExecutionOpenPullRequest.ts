import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Una ejecución puede pedir que al terminar solo suba la rama y no abra la PR (para probar sin dejar PRs abiertas). Las que ya
 * existen siguen abriéndola.
 */
export class ExecutionOpenPullRequest1794700000000 implements MigrationInterface {
  name = 'ExecutionOpenPullRequest1794700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "executions" ADD "open_pull_request" boolean NOT NULL DEFAULT true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "executions" DROP COLUMN "open_pull_request"`,
    );
  }
}
