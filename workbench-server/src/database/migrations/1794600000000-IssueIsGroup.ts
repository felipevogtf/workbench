import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Marca las tareas que son el grupo de una sesión del organizador, para mostrarlas aparte en la lista de tareas. Las que ya existen
 * se marcan por su sesión o por tener miembros.
 */
export class IssueIsGroup1794600000000 implements MigrationInterface {
  name = 'IssueIsGroup1794600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "issues" ADD "is_group" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `UPDATE "issues" SET "is_group" = true WHERE "id" IN (
        SELECT "group_issue_id" FROM "organizer_sessions"
        UNION SELECT "group_issue_id" FROM "issue_group_members")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "issues" DROP COLUMN "is_group"`);
  }
}
