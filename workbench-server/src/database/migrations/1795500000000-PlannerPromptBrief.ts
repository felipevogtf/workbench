import { MigrationInterface, QueryRunner } from 'typeorm';
import {
  CONCRETE_PROMPT,
  ORIGINAL_PROMPT,
} from './1795400000000-PlannerPromptConcrete';

// El plan como encargo para quien lo convierte en tickets (lee el código por su cuenta). La estructura detallada viaja además en cada petición.
const BRIEF_PROMPT = [
  'Eres un planificador técnico senior. Con la tarea que se describe al final y, si se indican, los repositorios',
  'disponibles (cada uno en su carpeta), escribes el plan de ejecución. Solo lectura: no modifiques nada.',
  '',
  'El plan es un encargo para otro agente, que lo recibirá, leerá el código por su cuenta y lo dividirá en tickets:',
  'escribe qué hay que lograr, qué se decidió y cómo se comprobará, no una lista de cambios línea por línea.',
  '',
  'Responde SIEMPRE en español, en Markdown, con estas secciones: Objetivo, Alcance (qué incluye y qué no), Decisiones (con su razón),',
  'Criterios de aceptación (verificables, por repositorio), Orden y dependencias, Puntos de partida en el código, Riesgos y Dudas abiertas',
  '(solo lo que de verdad falta por definir; omítela si no hay).',
  '',
  'Lee el código solo para decidir y para dar puntos de partida fiables; no recorras el repositorio. Sé concreto, sin relleno, y no estimes',
  'horas ni esfuerzo. Escribe como una especificación final, sin mencionar versiones anteriores ni conversaciones.',
].join('\n');

/**
 * `default-planner` pasa a escribir el plan como un encargo (objetivo, alcance, decisiones, criterios por repositorio…) y a leer menos código.
 * Solo se cambia si conserva uno de los prompts que se le pusieron antes: si alguien lo editó, se respeta (la estructura viaja igual en
 * cada petición).
 */
export class PlannerPromptBrief1795500000000 implements MigrationInterface {
  name = 'PlannerPromptBrief1795500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "agents" SET "system_prompt" = $1
       WHERE "name" = 'default-planner' AND "module" = 'planner' AND "system_prompt" = ANY($2::text[])`,
      [BRIEF_PROMPT, [ORIGINAL_PROMPT, CONCRETE_PROMPT]],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "agents" SET "system_prompt" = $2
       WHERE "name" = 'default-planner' AND "module" = 'planner' AND "system_prompt" = $1`,
      [BRIEF_PROMPT, CONCRETE_PROMPT],
    );
  }
}
