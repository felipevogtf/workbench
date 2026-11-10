import { MigrationInterface, QueryRunner } from 'typeorm';

export class PausedIssues1795700000000 implements MigrationInterface {
  name = 'PausedIssues1795700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "issues" ADD "paused_at" TIMESTAMP`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "issues" DROP COLUMN "paused_at"`);
  }
}
