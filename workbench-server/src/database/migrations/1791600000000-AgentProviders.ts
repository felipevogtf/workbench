import { MigrationInterface, QueryRunner } from 'typeorm';

export class AgentProviders1791600000000 implements MigrationInterface {
  name = 'AgentProviders1791600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "agents" ADD "provider" character varying NOT NULL DEFAULT 'claude'`,
    );
    await queryRunner.query(
      `CREATE TABLE "agent_provider_settings" ("provider" character varying NOT NULL, "enabled" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_agent_provider_settings" PRIMARY KEY ("provider"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "agent_provider_settings"`);
    await queryRunner.query(`ALTER TABLE "agents" DROP COLUMN "provider"`);
  }
}
