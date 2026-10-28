import { MigrationInterface, QueryRunner } from 'typeorm';

/** El modo «no molestar»: ajustes (activo, cada cuánto se mira, a quién se atiende) en una sola fila. */
export class AutoReply1794800000000 implements MigrationInterface {
  name = 'AutoReply1794800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "auto_reply_settings" ("id" character varying NOT NULL, "enabled" boolean NOT NULL DEFAULT false, "interval_seconds" integer NOT NULL DEFAULT 60, "mode" character varying NOT NULL DEFAULT 'draft', "contacts" jsonb NOT NULL DEFAULT '[]', "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_auto_reply_settings_id" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "auto_reply_settings"`);
  }
}
