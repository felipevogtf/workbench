import { MigrationInterface, QueryRunner } from 'typeorm';

export class ClosedIssuesAndFinalStates1792200000000 implements MigrationInterface {
  name = 'ClosedIssuesAndFinalStates1792200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "states" ADD "is_final" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(`ALTER TABLE "issues" ADD "closed_at" TIMESTAMP`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "issues" DROP COLUMN "closed_at"`);
    await queryRunner.query(`ALTER TABLE "states" DROP COLUMN "is_final"`);
  }
}
