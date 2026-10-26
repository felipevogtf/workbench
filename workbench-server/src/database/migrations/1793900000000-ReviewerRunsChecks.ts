import { MigrationInterface, QueryRunner } from 'typeorm';

const BEFORE = [
  'Read',
  'Grep',
  'Glob',
  'Bash(git diff:*)',
  'Bash(git log:*)',
  'Bash(git show:*)',
];

const AFTER = [
  ...BEFORE,
  'Bash(npm test:*)',
  'Bash(npm run test:*)',
  'Bash(npm run lint:*)',
  'Bash(npm run build:*)',
];

/**
 * El revisor de la ejecución puede correr las pruebas, el lint y el build: sin eso no podía comprobar el
 * criterio «compila sin errores» y lo dejaba como duda. Solo se cambian los revisores a los que nadie les
 * tocó las herramientas.
 */
export class ReviewerRunsChecks1793900000000 implements MigrationInterface {
  name = 'ReviewerRunsChecks1793900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "agents" SET "allowed_tools" = $1
        WHERE "module" = 'task-reviewer' AND "allowed_tools" = $2`,
      [AFTER, BEFORE],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "agents" SET "allowed_tools" = $1
        WHERE "module" = 'task-reviewer' AND "allowed_tools" = $2`,
      [BEFORE, AFTER],
    );
  }
}
