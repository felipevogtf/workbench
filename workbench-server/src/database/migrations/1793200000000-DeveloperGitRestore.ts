import { MigrationInterface, QueryRunner } from 'typeorm';

const BEFORE = [
  'Read',
  'Grep',
  'Glob',
  'Edit',
  'Write',
  'Bash(git status:*)',
  'Bash(git diff:*)',
  'Bash(git log:*)',
  'Bash(npm install:*)',
  'Bash(npm i:*)',
  'Bash(npm ci:*)',
  'Bash(npm test:*)',
  'Bash(npm run test:*)',
  'Bash(npm run lint:*)',
  'Bash(npm run build:*)',
];

const AFTER = [
  'Read',
  'Grep',
  'Glob',
  'Edit',
  'Write',
  'Bash(git status:*)',
  'Bash(git diff:*)',
  'Bash(git log:*)',
  'Bash(git restore:*)',
  'Bash(git checkout --:*)',
  'Bash(npm install:*)',
  'Bash(npm i:*)',
  'Bash(npm ci:*)',
  'Bash(npm test:*)',
  'Bash(npm run test:*)',
  'Bash(npm run lint:*)',
  'Bash(npm run build:*)',
];

/**
 * El desarrollador de la ejecución necesita deshacer sus propios cambios en archivos (por ejemplo
 * restaurar el lockfile que `npm install` reescribió de más): `git restore` y `git checkout --`, que
 * solo tocan archivos de su carpeta de trabajo aislada y no cambian de rama. Solo se cambia el agente
 * por defecto si nadie le tocó las herramientas desde la migración anterior.
 */
export class DeveloperGitRestore1793200000000 implements MigrationInterface {
  name = 'DeveloperGitRestore1793200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "agents" SET "allowed_tools" = $1
        WHERE "name" = 'default-task-developer' AND "module" = 'task-developer' AND "allowed_tools" = $2`,
      [AFTER, BEFORE],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "agents" SET "allowed_tools" = $1
        WHERE "name" = 'default-task-developer' AND "module" = 'task-developer' AND "allowed_tools" = $2`,
      [BEFORE, AFTER],
    );
  }
}
