import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Las sesiones del organizador: cada una es una tarea-grupo (ver `issue_group_members`) con un título. Si la tarea se borra, la
 * sesión se va con ella.
 */
export class OrganizerSessions1794300000000 implements MigrationInterface {
  name = 'OrganizerSessions1794300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "organizer_sessions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title" character varying NOT NULL,
        "group_issue_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_organizer_sessions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_organizer_sessions_group" UNIQUE ("group_issue_id"),
        CONSTRAINT "FK_organizer_sessions_group" FOREIGN KEY ("group_issue_id") REFERENCES "issues"("id") ON DELETE CASCADE
      )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "organizer_sessions"`);
  }
}
