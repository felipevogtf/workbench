import { MigrationInterface, QueryRunner } from 'typeorm';

export class KanbanBoards1791500000000 implements MigrationInterface {
  name = 'KanbanBoards1791500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "boards" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "description" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_606923b0b068ef262dfdcd18f44" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "board_issues" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "board_id" uuid NOT NULL, "issue_id" uuid NOT NULL, "position" integer NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_96f78e963f04d9eff576cfc561a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cb227bb983b8530a96ebc238ae" ON "board_issues" ("board_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_c7ed4e708d6bd1f89e781c5c3b" ON "board_issues" ("issue_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c7ed4e708d6bd1f89e781c5c3b"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_cb227bb983b8530a96ebc238ae"`,
    );
    await queryRunner.query(`DROP TABLE "board_issues"`);
    await queryRunner.query(`DROP TABLE "boards"`);
  }
}
