import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Los agentes pueden tener un nombre para mostrar y un avatar (los «trabajadores» de la automatización
 * se ven con nombre e imagen en el tablero). Los tres por defecto de la ejecución parten con nombre.
 */
export class AgentDisplayName1793300000000 implements MigrationInterface {
  name = 'AgentDisplayName1793300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "agents" ADD "display_name" character varying`,
    );
    await queryRunner.query(`ALTER TABLE "agents" ADD "avatar" text`);

    const names: [string, string][] = [
      ['default-task-tickets', 'Lucy'],
      ['default-task-developer', 'David'],
      ['default-task-reviewer', 'Maine'],
    ];
    for (const [agent, displayName] of names) {
      await queryRunner.query(
        `UPDATE "agents" SET "display_name" = $1 WHERE "name" = $2 AND "display_name" IS NULL`,
        [displayName, agent],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "agents" DROP COLUMN "avatar"`);
    await queryRunner.query(`ALTER TABLE "agents" DROP COLUMN "display_name"`);
  }
}
