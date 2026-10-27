import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Grupos de tareas: una tarea local que reúne a varias (sus miembros, en orden) para planificarlas y ejecutarlas juntas. Una tarea
 * es miembro de un solo grupo; si se borra el grupo o el miembro, la fila desaparece.
 */
export class IssueGroups1794200000000 implements MigrationInterface {
  name = 'IssueGroups1794200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "issue_group_members" (
        "group_issue_id" uuid NOT NULL,
        "member_issue_id" uuid NOT NULL,
        "position" integer NOT NULL,
        CONSTRAINT "PK_issue_group_members" PRIMARY KEY ("group_issue_id", "member_issue_id"),
        CONSTRAINT "UQ_issue_group_members_member" UNIQUE ("member_issue_id"),
        CONSTRAINT "FK_issue_group_members_group" FOREIGN KEY ("group_issue_id") REFERENCES "issues"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_issue_group_members_member" FOREIGN KEY ("member_issue_id") REFERENCES "issues"("id") ON DELETE CASCADE
      )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "issue_group_members"`);
  }
}
