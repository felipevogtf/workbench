import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1784445228155 implements MigrationInterface {
  name = 'InitialSchema1784445228155';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(
      `CREATE TABLE "labels" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "color" character varying, CONSTRAINT "PK_c0c4e97f76f1f3a268c7a70b925" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "projects" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "external_id" character varying, "name" character varying NOT NULL, "synced_at" TIMESTAMP NOT NULL DEFAULT now(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_82fe16de7d4f54a775018c70ce5" UNIQUE ("external_id"), CONSTRAINT "PK_6271df0a7aed1d6c0691ce6ac50" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "states" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "color" character varying, "position" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_09ab30ca0975c02656483265f4f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "issues" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "external_id" character varying, "is_local" boolean NOT NULL DEFAULT false, "name" character varying NOT NULL, "description" text, "priority" character varying, "external_state" character varying, "sequence_number" integer, "local_id" integer, "start_date" date, "due_date" date, "hours_worked" numeric(6,2), "synced_at" TIMESTAMP NOT NULL DEFAULT now(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "project_id" uuid, "state_id" uuid, CONSTRAINT "UQ_782247f02e92707803fe081740c" UNIQUE ("external_id"), CONSTRAINT "PK_9d8ecbbeff46229c700f0449257" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "issue_labels" ("issue_id" uuid NOT NULL, "label_id" uuid NOT NULL, CONSTRAINT "PK_1ac0a33ade1abb32c03516fa496" PRIMARY KEY ("issue_id", "label_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_68c7892926826f61d6a4a6f564" ON "issue_labels"  ("issue_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b0766ecbfc520efad8879ef13e" ON "issue_labels"  ("label_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "issues" ADD CONSTRAINT "FK_11f35e8296e10c229e7b68c68d4" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "issues" ADD CONSTRAINT "FK_ce7d55a3041e0e318e9a5e84473" FOREIGN KEY ("state_id") REFERENCES "states"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "issue_labels" ADD CONSTRAINT "FK_68c7892926826f61d6a4a6f564d" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "issue_labels" ADD CONSTRAINT "FK_b0766ecbfc520efad8879ef13e3" FOREIGN KEY ("label_id") REFERENCES "labels"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "issue_labels" DROP CONSTRAINT "FK_b0766ecbfc520efad8879ef13e3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "issue_labels" DROP CONSTRAINT "FK_68c7892926826f61d6a4a6f564d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "issues" DROP CONSTRAINT "FK_ce7d55a3041e0e318e9a5e84473"`,
    );
    await queryRunner.query(
      `ALTER TABLE "issues" DROP CONSTRAINT "FK_11f35e8296e10c229e7b68c68d4"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b0766ecbfc520efad8879ef13e"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_68c7892926826f61d6a4a6f564"`,
    );
    await queryRunner.query(`DROP TABLE "issue_labels"`);
    await queryRunner.query(`DROP TABLE "issues"`);
    await queryRunner.query(`DROP TABLE "states"`);
    await queryRunner.query(`DROP TABLE "projects"`);
    await queryRunner.query(`DROP TABLE "labels"`);
  }
}
