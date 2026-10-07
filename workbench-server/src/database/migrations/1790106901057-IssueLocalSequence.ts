import { MigrationInterface, QueryRunner } from 'typeorm';

export class IssueLocalSequence1790106901057 implements MigrationInterface {
  name = 'IssueLocalSequence1790106901057';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // local_id nunca se llegó a usar (siempre quedaba null) — se reemplaza
    // por local_sequence, que sí se asigna en cada creación/sync.
    await queryRunner.query(`ALTER TABLE "issues" DROP COLUMN "local_id"`);

    // sequence_number pasa a remote_sequence: ahora que existe un número
    // local, el nombre viejo era ambiguo sobre a cuál de los dos se refería.
    await queryRunner.query(
      `ALTER TABLE "issues" RENAME COLUMN "sequence_number" TO "remote_sequence"`,
    );

    await queryRunner.query(
      `ALTER TABLE "issues" ADD COLUMN "local_sequence" integer`,
    );

    // Backfill: numera las filas existentes por proyecto, en orden de
    // creación, para que la columna pueda quedar NOT NULL sin perder datos.
    await queryRunner.query(`
      WITH numbered AS (
        SELECT id, ROW_NUMBER() OVER (
          PARTITION BY project_id ORDER BY created_at
        ) AS rn
        FROM "issues"
      )
      UPDATE "issues" i
      SET local_sequence = numbered.rn
      FROM numbered
      WHERE i.id = numbered.id
    `);

    await queryRunner.query(
      `ALTER TABLE "issues" ALTER COLUMN "local_sequence" SET NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "issues" ALTER COLUMN "local_sequence" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "issues" DROP COLUMN "local_sequence"`,
    );
    await queryRunner.query(
      `ALTER TABLE "issues" RENAME COLUMN "remote_sequence" TO "sequence_number"`,
    );
    await queryRunner.query(
      `ALTER TABLE "issues" ADD COLUMN "local_id" integer`,
    );
  }
}
