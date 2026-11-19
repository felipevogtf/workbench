import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * La ejecución nace como borrador (`draft`) y empieza con el play. El estado `awaiting` (tickets listos, esperando el visto bueno) era
 * ya ese borrador, así que pasa a llamarse así.
 */
export class ExecutionDraft1796300000000 implements MigrationInterface {
  name = 'ExecutionDraft1796300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "executions" SET "status" = 'draft' WHERE "status" = 'awaiting'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "executions" SET "status" = 'awaiting' WHERE "status" = 'draft'`,
    );
  }
}
