import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Los proyectos (repositorios) de cada tarea, en orden. Vacío = los de sus etiquetas, como hasta ahora. Los
 * proyectos ganan además el enlace de su repositorio, que hasta ahora solo tenían las etiquetas.
 */
export class IssueProjectRepos1796000000000 implements MigrationInterface {
  name = 'IssueProjectRepos1796000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "issues" ADD "project_repos" jsonb NOT NULL DEFAULT '[]'`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" ADD "repo_url" character varying`,
    );
    // El enlace sale de la etiqueta que apunta al repositorio (https://host/org/repo).
    await queryRunner.query(
      `UPDATE "projects" p SET "repo_url" = (
         SELECT l."repo_url" FROM "labels" l
         WHERE l."repo_url" IS NOT NULL
           AND lower(regexp_replace(l."repo_url", '^https?://[^/]+/', '')) = p."repo"
         ORDER BY l."name" LIMIT 1
       )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "repo_url"`);
    await queryRunner.query(`ALTER TABLE "issues" DROP COLUMN "project_repos"`);
  }
}
