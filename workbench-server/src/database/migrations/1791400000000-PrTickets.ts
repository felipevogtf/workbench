import { MigrationInterface, QueryRunner } from 'typeorm';

export class PrTickets1791400000000 implements MigrationInterface {
  name = 'PrTickets1791400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "pull_requests" ADD "description" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "pull_requests" ADD "ticket_keys" text array NOT NULL DEFAULT '{}'`,
    );
    await queryRunner.query(
      `ALTER TABLE "reviews" ADD "tickets" jsonb NOT NULL DEFAULT '[]'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "reviews" DROP COLUMN "tickets"`);
    await queryRunner.query(
      `ALTER TABLE "pull_requests" DROP COLUMN "ticket_keys"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pull_requests" DROP COLUMN "description"`,
    );
  }
}
