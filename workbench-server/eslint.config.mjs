// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const MODULES = [
  'ai-agents',
  'kanban',
  'planner',
  'pr-review',
  'tasks',
  'time-tracking',
];

/** Alias de cada módulo (tsconfig paths): @ai-agents/*, @pr-review/*, etc. */
const others = (name) => MODULES.filter((module) => module !== name);

/**
 * Fronteras entre módulos (arquitectura hexagonal):
 * - dominio y aplicación no conocen a los demás módulos ni a TypeORM;
 * - solo los adaptadores (gateways) y el *.module.ts hablan con otro módulo, y nunca con su infraestructura.
 */
const boundaryConfigs = MODULES.flatMap((name) => [
  {
    files: [
      `src/${name}/domain/**/*.ts`,
      `src/${name}/application/**/*.ts`,
      `src/${name}/dto/**/*.ts`,
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: others(name).map((other) => `@${other}/*`),
              message:
                'Un módulo solo habla con otro desde sus adaptadores (infrastructure/adapters).',
            },
            {
              group: ['typeorm', '@nestjs/typeorm'],
              message:
                'TypeORM pertenece a la infraestructura, no al dominio ni a la aplicación.',
            },
          ],
        },
      ],
    },
  },
  {
    files: [`src/${name}/infrastructure/**/*.ts`],
    ignores: [`src/${name}/infrastructure/adapters/**`],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: others(name).map((other) => `@${other}/*`),
              message:
                'Un módulo solo habla con otro desde sus adaptadores (infrastructure/adapters).',
            },
          ],
        },
      ],
    },
  },
  {
    files: [`src/${name}/infrastructure/adapters/**/*.ts`],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: others(name).map((other) => `@${other}/infrastructure/*`),
              message:
                'Se consume la API pública del otro módulo (facade/servicios), no su infraestructura.',
            },
          ],
        },
      ],
    },
  },
]);

export default tseslint.config(
  {
    // Las migraciones las genera TypeORM sin formato de prettier.
    ignores: ['eslint.config.mjs', 'src/database/migrations/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  ...boundaryConfigs,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
    },
  },
);
