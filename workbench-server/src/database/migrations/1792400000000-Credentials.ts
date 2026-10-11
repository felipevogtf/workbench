import { MigrationInterface, QueryRunner } from 'typeorm';

export class Credentials1792400000000 implements MigrationInterface {
  name = 'Credentials1792400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "credential_groups" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "category" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_credential_groups" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "credential_items" ("id" uuid NOT NULL, "group_id" uuid NOT NULL, "key" character varying NOT NULL, "value_enc" text NOT NULL, "sensitive" boolean NOT NULL DEFAULT false, "position" integer NOT NULL, CONSTRAINT "PK_credential_items" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_credential_items_group_id" ON "credential_items" ("group_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_credential_items_group_id"`,
    );
    await queryRunner.query(`DROP TABLE "credential_items"`);
    await queryRunner.query(`DROP TABLE "credential_groups"`);
  }
}
