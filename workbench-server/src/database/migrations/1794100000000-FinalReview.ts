import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * La revisión final de una ejecución: el informe que un agente revisor hace de toda la rama cuando el usuario lo
 * pide. Se guarda en la propia ejecución.
 */
export class FinalReview1794100000000 implements MigrationInterface {
  name = 'FinalReview1794100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "executions" ADD "final_review" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "executions" DROP COLUMN "final_review"`,
    );
  }
}
