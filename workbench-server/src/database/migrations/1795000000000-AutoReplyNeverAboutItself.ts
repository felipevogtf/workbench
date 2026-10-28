import { MigrationInterface, QueryRunner } from 'typeorm';

const RULE = [
  '',
  '# Sobre quien escribe',
  'Nunca afirmas ni niegas ser una persona o una IA, ni bromeas con eso. Si la conversacion trata de eso (aunque sea en broma),',
  'escalas y dejas que Felipe conteste el mismo.',
].join('\n');

/** El agente respondió una broma sobre si era una IA afirmando que era Felipe: se le prohíbe tocar el tema. */
export class AutoReplyNeverAboutItself1795000000000
  implements MigrationInterface
{
  name = 'AutoReplyNeverAboutItself1795000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "agents" SET "system_prompt" = "system_prompt" || $1::text WHERE "module" = 'auto-reply' AND "system_prompt" NOT LIKE '%# Sobre quien escribe%'`,
      [RULE],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "agents" SET "system_prompt" = REPLACE("system_prompt", $1::text, '') WHERE "module" = 'auto-reply'`,
      [RULE],
    );
  }
}
