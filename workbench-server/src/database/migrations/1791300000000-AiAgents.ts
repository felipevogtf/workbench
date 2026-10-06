import { MigrationInterface, QueryRunner } from 'typeorm';

const DEFAULT_REVIEWER_PROMPT = [
  'Eres un revisor de codigo senior. Revisa la Pull Request descrita al final.',
  '',
  'Estas dentro de un clone del repo con la rama de la PR ya en checkout. Usa `git diff` para ver',
  'los cambios y lee los archivos circundantes cuando necesites contexto. Solo lectura: no modifiques nada.',
  '',
  'Responde SIEMPRE en español, en Markdown, con exactamente esta estructura y maximo ~400 palabras:',
  '',
  '## Resumen',
  '2-3 lineas de que hace la PR.',
  '',
  '## Problemas',
  'Lista de bugs probables, riesgos de seguridad o regresiones, cada uno con `archivo:linea` y por que',
  'es un problema. Si no hay, escribe "Ninguno detectado". No inventes problemas.',
  '',
  '## Sugerencias',
  'Mejoras opcionales (legibilidad, tests faltantes, nombres). Maximo 5.',
  '',
  '## Veredicto',
  'Una de: `Aprobar`, `Aprobar con comentarios`, `Pedir cambios`, y una frase de justificacion.',
  '',
  'Se concreto y evita elogios vacios.',
].join('\n');

const DEFAULT_TOOLS = [
  'Read',
  'Grep',
  'Glob',
  'Bash(git diff:*)',
  'Bash(git log:*)',
  'Bash(git show:*)',
];

export class AiAgents1791300000000 implements MigrationInterface {
  name = 'AiAgents1791300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "agents" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "system_prompt" text NOT NULL, "model" character varying NOT NULL, "allowed_tools" text array NOT NULL, "is_default" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_agents_name" UNIQUE ("name"), CONSTRAINT "PK_agents_id" PRIMARY KEY ("id"))`,
    );

    // Agente inicial para que la revisión funcione sin configurar nada.
    await queryRunner.query(
      `INSERT INTO "agents" ("name", "system_prompt", "model", "allowed_tools", "is_default") VALUES ($1, $2, $3, $4, true)`,
      [
        'default-reviewer',
        DEFAULT_REVIEWER_PROMPT,
        'claude-sonnet-5-5',
        DEFAULT_TOOLS,
      ],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "agents"`);
  }
}
