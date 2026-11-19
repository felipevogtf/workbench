import { MigrationInterface, QueryRunner } from 'typeorm';
import { cleanPlan } from '../../planner/domain/plan-text';

/**
 * Quita de los planes ya guardados lo que el modelo escribió antes del plan («Ya tengo suficiente contexto… voy a escribir el plan»), que
 * se veía como parte del documento. Solo se toca lo que hay antes del primer encabezado; no hay vuelta atrás de ese texto.
 */
export class CleanPlanPreambles1796500000000 implements MigrationInterface {
  name = 'CleanPlanPreambles1796500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const rows: { id: string; content: string }[] = await queryRunner.query(
      `SELECT "id", "content" FROM "plans" WHERE "content" IS NOT NULL AND "content" <> '' AND "content" !~ '^\s*#'`,
    );
    for (const row of rows) {
      const cleaned = cleanPlan(row.content);
      if (cleaned && cleaned !== row.content) {
        await queryRunner.query(
          `UPDATE "plans" SET "content" = $1 WHERE "id" = $2`,
          [cleaned, row.id],
        );
      }
    }
  }

  public async down(): Promise<void> {
    // El texto que se quitó era charla del modelo: no se guardó.
  }
}
