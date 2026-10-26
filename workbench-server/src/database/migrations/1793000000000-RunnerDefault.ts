import { MigrationInterface, QueryRunner } from 'typeorm';

/** Un runner predeterminado: el primero en tomar trabajo y el que la app intenta despertar. */
export class RunnerDefault1793000000000 implements MigrationInterface {
  name = 'RunnerDefault1793000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "runners" ADD "is_default" boolean NOT NULL DEFAULT false`,
    );
    // Si ya había runners, el más antiguo pasa a ser el predeterminado.
    await queryRunner.query(
      `UPDATE "runners" SET "is_default" = true
        WHERE "id" = (SELECT "id" FROM "runners" ORDER BY "created_at" ASC LIMIT 1)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "runners" DROP COLUMN "is_default"`);
  }
}
