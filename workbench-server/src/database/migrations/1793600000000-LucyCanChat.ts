import { MigrationInterface, QueryRunner } from 'typeorm';

const BEFORE =
  'Respondes SIEMPRE y UNICAMENTE con el JSON que se te pida, sin texto antes ni despues.';
const AFTER = [
  'Cuando te piden un JSON, respondes UNICAMENTE con ese JSON, sin texto antes ni despues.',
  'Cuando conversas con el usuario sobre la ejecucion, respondes en español, claro y directo, en Markdown.',
].join('\n');

/**
 * Lucy ahora también conversa con el usuario sobre la ejecución. Su prompt le exigía responder siempre solo
 * con JSON, y eso choca con una conversación: se cambia solo esa frase, y solo si nadie la editó.
 */
export class LucyCanChat1793600000000 implements MigrationInterface {
  name = 'LucyCanChat1793600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "agents" SET "system_prompt" = REPLACE("system_prompt", $1::text, $2::text) WHERE "module" = 'task-tickets'`,
      [BEFORE, AFTER],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "agents" SET "system_prompt" = REPLACE("system_prompt", $2::text, $1::text) WHERE "module" = 'task-tickets'`,
      [BEFORE, AFTER],
    );
  }
}
