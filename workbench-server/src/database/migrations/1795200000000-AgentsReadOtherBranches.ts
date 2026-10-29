import { MigrationInterface, QueryRunner } from 'typeorm';

const READ_GIT = ['Bash(git show:*)', 'Bash(git branch -r:*)', 'Bash(git ls-tree:*)'];

// Qué herramientas de lectura de git se les suman a los agentes de cada módulo (lo que ya tengan se respeta).
const ADDED: Record<string, string[]> = {
  'task-tickets': [...READ_GIT, 'Bash(git diff:*)'],
  'task-developer': READ_GIT,
  'task-reviewer': READ_GIT,
};

/**
 * Los agentes de la ejecución pueden leer la rama de otro ticket que la tarea mencione (el backend que una app necesita,
 * ya hecho pero sin mergear): `git show`, `git ls-tree` y `git branch -r`, todo de solo lectura. Solo se suma lo que falta.
 */
export class AgentsReadOtherBranches1795200000000
  implements MigrationInterface
{
  name = 'AgentsReadOtherBranches1795200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [module, tools] of Object.entries(ADDED)) {
      await queryRunner.query(
        `UPDATE "agents" SET "allowed_tools" = "allowed_tools" || ARRAY(SELECT t FROM unnest($2::text[]) AS t WHERE t <> ALL("allowed_tools"))
         WHERE "module" = $1 AND "provider" = 'claude'`,
        [module, tools],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [module, tools] of Object.entries(ADDED)) {
      await queryRunner.query(
        `UPDATE "agents" SET "allowed_tools" = ARRAY(SELECT t FROM unnest("allowed_tools") AS t WHERE t <> ALL($2::text[]))
         WHERE "module" = $1 AND "provider" = 'claude'`,
        [module, tools],
      );
    }
  }
}
