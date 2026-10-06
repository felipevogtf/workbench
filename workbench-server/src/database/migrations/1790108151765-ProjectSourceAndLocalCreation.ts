import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProjectSourceAndLocalCreation1790108151765
  implements MigrationInterface
{
  name = 'ProjectSourceAndLocalCreation1790108151765';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "projects" ADD COLUMN "source" character varying`,
    );

    // Hoy Plane es la única fuente que existió: todo proyecto ya sincronizado
    // (tiene external_id) es de Plane.
    await queryRunner.query(
      `UPDATE "projects" SET "source" = 'plane' WHERE "external_id" IS NOT NULL`,
    );

    // synced_at deja de ser NOT NULL / auto-manejado: un proyecto local nunca
    // se sincroniza, así que el valor por defecto correcto es null, no now().
    await queryRunner.query(
      `ALTER TABLE "projects" ALTER COLUMN "synced_at" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" ALTER COLUMN "synced_at" DROP DEFAULT`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Backfill defensivo: si algún proyecto local quedó con synced_at null,
    // no se puede volver a NOT NULL sin darle un valor primero.
    await queryRunner.query(
      `UPDATE "projects" SET "synced_at" = "created_at" WHERE "synced_at" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" ALTER COLUMN "synced_at" SET DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" ALTER COLUMN "synced_at" SET NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "source"`);
  }
}
