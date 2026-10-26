import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Consumo de Claude: lo que gasta cada trabajo (tokens, y cómo iba el plan mientras corría) y las medidas
 * del plan a lo largo del tiempo, para saber cuánto de la ventana de 5 horas y de la semana cuesta cada
 * ejecución.
 */
export class UsageTracking1793800000000 implements MigrationInterface {
  name = 'UsageTracking1793800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "execution_jobs" ADD "usage" jsonb`);
    await queryRunner.query(
      `CREATE TABLE "usage_snapshots" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "taken_at" TIMESTAMP NOT NULL, "five_hour_used" double precision, "five_hour_resets_at" TIMESTAMP, "seven_day_used" double precision, "seven_day_resets_at" TIMESTAMP, "source" character varying NOT NULL, "job_id" uuid, CONSTRAINT "PK_usage_snapshots_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_usage_snapshots_taken_at" ON "usage_snapshots" ("taken_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_usage_snapshots_taken_at"`,
    );
    await queryRunner.query(`DROP TABLE "usage_snapshots"`);
    await queryRunner.query(`ALTER TABLE "execution_jobs" DROP COLUMN "usage"`);
  }
}
