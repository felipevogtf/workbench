import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProjectSyncAndVisibility1792300000000 implements MigrationInterface {
  name = 'ProjectSyncAndVisibility1792300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "projects" ADD "sync_enabled" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" ADD "visible" boolean NOT NULL DEFAULT true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "visible"`);
    await queryRunner.query(
      `ALTER TABLE "projects" DROP COLUMN "sync_enabled"`,
    );
  }
}
