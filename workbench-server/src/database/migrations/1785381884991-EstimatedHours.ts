import { MigrationInterface, QueryRunner } from 'typeorm';

export class EstimatedHours1785381884991 implements MigrationInterface {
  name = 'EstimatedHours1785381884991';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "issues" RENAME COLUMN "hours_worked" TO "estimated_hours"`,
    );
    await queryRunner.query(
      `ALTER TABLE "issues" ALTER COLUMN "estimated_hours" TYPE numeric(10,2)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "issues" ALTER COLUMN "estimated_hours" TYPE numeric(6,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "issues" RENAME COLUMN "estimated_hours" TO "hours_worked"`,
    );
  }
}
