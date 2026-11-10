import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Consumo de las llamadas a la IA que hace el servidor (planificador, chat de tarea, chat de la ejecución,
 * revisión de PR…): hasta ahora solo se medía lo que corre en el runner.
 */
export class AiCallsUsage1795600000000 implements MigrationInterface {
  name = 'AiCallsUsage1795600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "ai_calls" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "at" TIMESTAMP NOT NULL, "module" character varying NOT NULL, "agent_id" uuid, "agent_name" character varying, "model" character varying, "input_tokens" double precision NOT NULL DEFAULT '0', "output_tokens" double precision NOT NULL DEFAULT '0', "cache_write_tokens" double precision NOT NULL DEFAULT '0', "cache_read_tokens" double precision NOT NULL DEFAULT '0', "cost_usd" double precision NOT NULL DEFAULT '0', CONSTRAINT "PK_ai_calls_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ai_calls_at" ON "ai_calls" ("at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_ai_calls_at"`);
    await queryRunner.query(`DROP TABLE "ai_calls"`);
  }
}
