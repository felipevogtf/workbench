import { MigrationInterface, QueryRunner } from 'typeorm';

// Los proveedores habilitados pasaron a la variable de entorno AGENT_PROVIDERS.
export class DropProviderSettings1791700000000 implements MigrationInterface {
  name = 'DropProviderSettings1791700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "agent_provider_settings"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "agent_provider_settings" ("provider" character varying NOT NULL, "enabled" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_agent_provider_settings" PRIMARY KEY ("provider"))`,
    );
  }
}
