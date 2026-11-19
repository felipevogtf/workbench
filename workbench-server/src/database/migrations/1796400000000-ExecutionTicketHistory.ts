import { MigrationInterface, QueryRunner } from 'typeorm';

/** Los cambios de Lucy (y del usuario) a los tickets del borrador, con los tickets eliminados, para poder deshacerlos. */
export class ExecutionTicketHistory1796400000000 implements MigrationInterface {
  name = 'ExecutionTicketHistory1796400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "executions" ADD "ticket_history" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "executions" DROP COLUMN "ticket_history"`,
    );
  }
}
