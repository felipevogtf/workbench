import { MigrationInterface, QueryRunner } from 'typeorm';

/** Un personaje de Cyberpunk: Edgerunners (el anime) para cada agente que aún no tiene uno, según lo que hace. */
const NAMES: [agent: string, displayName: string][] = [
  ['default-planner', 'Faraday'],
  ['default-reviewer', 'Doc'],
  ['copilot-reviewer', 'Falco'],
  ['default-task-chat', 'Gloria'],
  ['default-chat', 'Dorio'],
];

/**
 * Todos los agentes pasan a ser «trabajadores», con nombre. Los de la ejecución de tareas ya lo tienen
 * (Lucy, David, Maine, Rebecca, Kiwi, Pilar); los demás reciben el suyo, sin tocar el de quien ya lo cambió.
 */
export class WorkerNames1793700000000 implements MigrationInterface {
  name = 'WorkerNames1793700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [agent, displayName] of NAMES) {
      await queryRunner.query(
        `UPDATE "agents" SET "display_name" = $1::varchar WHERE "name" = $2::varchar AND "display_name" IS NULL`,
        [displayName, agent],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [agent, displayName] of NAMES) {
      await queryRunner.query(
        `UPDATE "agents" SET "display_name" = NULL WHERE "name" = $1::varchar AND "display_name" = $2::varchar`,
        [agent, displayName],
      );
    }
  }
}
