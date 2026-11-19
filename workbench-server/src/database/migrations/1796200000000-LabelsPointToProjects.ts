import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Una etiqueta ya no guarda el enlace de un repositorio: apunta a un proyecto (`org/repo`) y el enlace sale de él, así
 * cambiarlo se hace en un solo lugar. Los repositorios que hasta ahora solo existían como enlace de una etiqueta pasan a
 * ser un proyecto, y la columna vieja se borra.
 */
export class LabelsPointToProjects1796200000000 implements MigrationInterface {
  name = 'LabelsPointToProjects1796200000000';

  private static readonly REPO_OF_LINK = `lower(regexp_replace(regexp_replace(l."repo_url", '^https?://[^/]+/', ''), '\.git$', ''))`;

  public async up(queryRunner: QueryRunner): Promise<void> {
    const repoOf = LabelsPointToProjects1796200000000.REPO_OF_LINK;
    await queryRunner.query(
      `ALTER TABLE "labels" ADD "project_repo" character varying`,
    );
    await queryRunner.query(
      `UPDATE "labels" l SET "project_repo" = ${repoOf} WHERE l."repo_url" IS NOT NULL`,
    );
    // Un repositorio que solo tenía etiqueta pasa a ser un proyecto, con el enlace de la etiqueta.
    await queryRunner.query(
      `INSERT INTO "projects" ("id", "repo", "name", "repo_url")
       SELECT gen_random_uuid(), l."project_repo", split_part(l."project_repo", '/', 2), min(l."repo_url")
       FROM "labels" l
       WHERE l."project_repo" IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM "projects" p WHERE p."repo" = l."project_repo")
       GROUP BY l."project_repo"`,
    );
    // Un proyecto sin enlace lo toma de la etiqueta que lo tenía.
    await queryRunner.query(
      `UPDATE "projects" p SET "repo_url" = (
         SELECT l."repo_url" FROM "labels" l
         WHERE l."project_repo" = p."repo" AND l."repo_url" IS NOT NULL
         ORDER BY l."name" LIMIT 1
       ) WHERE p."repo_url" IS NULL`,
    );
    await queryRunner.query(`ALTER TABLE "labels" DROP COLUMN "repo_url"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "labels" ADD "repo_url" character varying`,
    );
    await queryRunner.query(
      `UPDATE "labels" l SET "repo_url" = (
         SELECT p."repo_url" FROM "projects" p WHERE p."repo" = l."project_repo"
       ) WHERE l."project_repo" IS NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "labels" DROP COLUMN "project_repo"`);
  }
}
