import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Las sesiones del organizador pueden ser de una sola tarea (`task`): cuelgan de la propia tarea en vez de una tarea-grupo. Las
 * que ya existían son grupos.
 */
export class OrganizerTaskSessions1795300000000 implements MigrationInterface {
  name = 'OrganizerTaskSessions1795300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "organizer_sessions" ADD "kind" character varying NOT NULL DEFAULT 'group'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "organizer_sessions" WHERE "kind" = 'task'`,
    );
    await queryRunner.query(
      `ALTER TABLE "organizer_sessions" DROP COLUMN "kind"`,
    );
  }
}
