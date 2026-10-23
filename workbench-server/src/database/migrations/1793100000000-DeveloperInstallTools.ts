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
  'Bash(npm install:*)',
  'Bash(npm i:*)',
  'Bash(npm ci:*)',
  'Bash(npm test:*)',
  'Bash(npm run test:*)',
  'Bash(npm run lint:*)',
  'Bash(npm run build:*)',
];

/**
 * El desarrollador de la ejecución necesita instalar dependencias (`npm install`): sin eso no puede
 * compilar ni corregir lo que el revisor pide cuando falta `node_modules`. Solo se cambia el agente
 * por defecto si nadie le tocó las herramientas.
 */
export class DeveloperInstallTools1793100000000 implements MigrationInterface {
  name = 'DeveloperInstallTools1793100000000';

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
