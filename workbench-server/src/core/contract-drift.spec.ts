import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AGENT_MODULES, MODULE_TOOLS } from '@ai-agents/domain/modules';
import { AGENT_PROVIDERS } from '@ai-agents/domain/providers';
import { ISSUE_PRIORITIES } from '@tasks/domain/entities/issue.entity';
import { LABEL_COLORS } from '@tasks/domain/label-colors';

/**
 * El front repite a mano algunas constantes del backend (paleta, herramientas por módulo, prioridades…).
 * Este test falla si alguna deja de coincidir. Se omite cuando el front no está junto al backend
 * (por ejemplo dentro de la imagen de Docker del servidor).
 */
const FRONT = join(__dirname, '..', '..', '..', 'workbench-app', 'src', 'app');
const describeIfFront = existsSync(FRONT) ? describe : describe.skip;

const frontFile = (path: string): string =>
  readFileSync(join(FRONT, path), 'utf8');

/** Los textos entre comillas simples de un trozo de código. */
const quoted = (source: string): string[] =>
  [...source.matchAll(/'([^']+)'/g)].map((match) => match[1]);

/** Lo que hay desde `marker` hasta el primer `;` (la declaración completa). */
const declaration = (source: string, marker: string): string => {
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`No se encontró «${marker}»`);
  return source.slice(start, source.indexOf(';\n', start));
};

describeIfFront('front ↔ back contract', () => {
  it('uses the same label color palette', () => {
    const source = frontFile('shared/ui/color-input/color-input.ts');
    const colors = [...source.matchAll(/'(#[0-9a-fA-F]{6})'/g)].map(
      (match) => match[1],
    );

    expect(colors.slice(0, LABEL_COLORS.length)).toEqual([...LABEL_COLORS]);
  });

  it('offers each agent module the same tools', () => {
    const source = frontFile('ai-agents/models/agent.ts');
    const block = declaration(source, 'export const MODULE_TOOLS');

    for (const module of AGENT_MODULES) {
      const line = block
        .split('\n')
        .find(
          (row) =>
            row.trim().startsWith(`'${module}'`) ||
            row.trim().startsWith(`${module}:`),
        );
      expect(line).toBeDefined();
      expect(quoted(line!.slice(line!.indexOf(':') + 1))).toEqual([
        ...MODULE_TOOLS[module],
      ]);
    }
  });

  it('knows the same agent modules and providers', () => {
    const source = frontFile('ai-agents/models/agent.ts');

    expect(quoted(declaration(source, 'export type AgentModule'))).toEqual([
      ...AGENT_MODULES,
    ]);
    expect(quoted(declaration(source, 'export type AgentProvider'))).toEqual([
      ...AGENT_PROVIDERS,
    ]);
  });

  it('knows the same issue priorities', () => {
    const source = frontFile('tasks/models/issue.ts');

    expect(quoted(declaration(source, 'export type IssuePriority'))).toEqual(
      ISSUE_PRIORITIES,
    );
  });
});
