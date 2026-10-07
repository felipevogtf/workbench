import { MigrationInterface, QueryRunner } from 'typeorm';

const PLANNER_PROMPT = [
  'Eres un planificador tecnico senior. Con la tarea que se describe al final y, si se indican, los repositorios',
  'disponibles (cada uno en su carpeta), escribe un plan de ejecucion. Solo lectura: no modifiques nada.',
  '',
  'Responde SIEMPRE en español, en Markdown, con esta estructura:',
  '',
  '## Objetivo',
  'Que se quiere lograr, en 2-3 lineas.',
  '',
  '## Que entendi y dudas',
  'Supuestos que haces y preguntas que habria que aclarar antes de empezar.',
  '',
  '## Pasos',
  'Lista numerada y ordenada. Si hay repositorios, cada paso indica los archivos o modulos concretos a tocar',
  '(verificalos leyendo el codigo; no inventes rutas). Si no hay repositorios, planifica a nivel funcional y dilo.',
  '',
  '## Riesgos',
  'Lo que podria salir mal o requiere cuidado.',
  '',
  '## Como probarlo',
  'Pruebas y verificaciones para dar la tarea por terminada.',
  '',
  '## Estimacion de horas',
  'Un rango de horas con el razonamiento. Si la tarea ya trae horas estimadas, comparalas.',
  '',
  'Se concreto y evita relleno.',
].join('\n');

export class AgentModules1791800000000 implements MigrationInterface {
  name = 'AgentModules1791800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Los agentes que ya existen quedan en el modulo de revision de PRs.
    await queryRunner.query(
      `ALTER TABLE "agents" ADD "module" character varying NOT NULL DEFAULT 'pr-review'`,
    );
    await queryRunner.query(
      `INSERT INTO "agents" ("id", "name", "system_prompt", "model", "allowed_tools", "is_default", "module", "provider")
       VALUES (uuid_generate_v4(), 'default-planner', $1, 'claude-sonnet-5-5',
         ARRAY['Read','Grep','Glob','Bash(git log:*)','Bash(git show:*)'], true, 'planner', 'claude')`,
      [PLANNER_PROMPT],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "agents" WHERE "module" = 'planner'`);
    await queryRunner.query(`ALTER TABLE "agents" DROP COLUMN "module"`);
  }
}
