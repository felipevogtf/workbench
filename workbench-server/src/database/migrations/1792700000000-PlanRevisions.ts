import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Replanificar: el plan nuevo guarda la conversación con la que se pidió y el plan del que parte. Los
 * planes se generan en cola desde la base de datos, así que ese contexto tiene que estar guardado en el plan.
 */
export class PlanRevisions1792700000000 implements MigrationInterface {
  name = 'PlanRevisions1792700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plans" ADD "conversation" jsonb`);
    await queryRunner.query(`ALTER TABLE "plans" ADD "based_on_plan_id" uuid`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "plans" DROP COLUMN "based_on_plan_id"`,
    );
    await queryRunner.query(`ALTER TABLE "plans" DROP COLUMN "conversation"`);
  }
}
