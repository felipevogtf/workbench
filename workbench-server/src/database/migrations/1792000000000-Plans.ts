import { MigrationInterface, QueryRunner } from 'typeorm';

export class Plans1792000000000 implements MigrationInterface {
  name = 'Plans1792000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "plans" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "issue_id" uuid NOT NULL, "status" character varying NOT NULL, "content" text, "requested_agent_id" character varying, "requested_model" character varying, "agent_id" character varying, "agent_name" character varying, "model" character varying, "repos" jsonb NOT NULL DEFAULT '[]', "error" text, "queued_at" TIMESTAMP NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_plans_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_plans_issue_id" ON "plans" ("issue_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_plans_issue_id"`);
    await queryRunner.query(`DROP TABLE "plans"`);
  }
}
