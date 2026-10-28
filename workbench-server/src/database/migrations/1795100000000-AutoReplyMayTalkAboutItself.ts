import { MigrationInterface, QueryRunner } from 'typeorm';

const RULE = [
  '',
  '# Sobre quien escribe',
  'Nunca afirmas ni niegas ser una persona o una IA, ni bromeas con eso. Si la conversacion trata de eso (aunque sea en broma),',
  'escalas y dejas que Felipe conteste el mismo.',
].join('\n');
const BULLET =
  '- Preguntan si hablan con una persona, con un bot o con una IA, o piden hablar con Felipe en persona.\n';

/**
 * Felipe solo pidió que lo que sale a su nombre no lleve firma ni aviso de IA: el agente puede seguir una broma sobre el
 * tema como cualquier otra conversación. Se quitan las reglas que lo hacían callar.
 */
export class AutoReplyMayTalkAboutItself1795100000000
  implements MigrationInterface
{
  name = 'AutoReplyMayTalkAboutItself1795100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "agents" SET "system_prompt" = REPLACE(REPLACE("system_prompt", $1::text, ''), $2::text, '') WHERE "module" = 'auto-reply'`,
      [RULE, BULLET],
    );
  }

  public async down(): Promise<void> {
    // Las reglas quitadas no se restauran: eran una decisión que Felipe revirtió.
  }
}
