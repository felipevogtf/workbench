// @ts-check
const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

const stateMessage =
  'Respeta los límites entre módulos (ver docs/plans/pr-review-ui.md, sección 6, y tasks-kanban-ui.md, sección 5).';

module.exports = tseslint.config(
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...tseslint.configs.stylistic,
      ...angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      // Los componentes de UI usan selectores de atributo sobre elementos nativos (button[app-button]).
      '@angular-eslint/component-selector': 'off',
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'app', style: 'camelCase' },
      ],
      '@angular-eslint/prefer-on-push-component-change-detection': 'error',
      '@angular-eslint/prefer-standalone': 'error',
      '@angular-eslint/no-input-rename': 'error',
      '@typescript-eslint/consistent-type-imports': 'off',
      '@typescript-eslint/no-inferrable-types': 'off',
    },
  },
  {
    files: ['**/*.html'],
    extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
    rules: {},
  },

  // --- Límites entre módulos ---
  // shared no conoce a core ni a los módulos.
  {
    files: ['src/app/shared/**/*.ts'],
    ignores: ['**/*.spec.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@core/*', '@pr-review/*', '@ai-agents/*', '@tasks/*', '@kanban/*'],
              message: stateMessage,
            },
          ],
        },
      ],
    },
  },
  // pr-review solo toca a ai-agents por su API pública (@ai-agents/index).
  {
    files: ['src/app/pr-review/**/*.ts'],
    ignores: ['**/*.spec.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@ai-agents/*', '!@ai-agents/index'], message: stateMessage },
            { group: ['@tasks/*', '@kanban/*'], message: stateMessage },
            { group: ['@core/layout/*'], message: stateMessage },
          ],
        },
      ],
    },
  },
  // ai-agents solo toca a pr-review por su API pública (@pr-review/index).
  {
    files: ['src/app/ai-agents/**/*.ts'],
    ignores: ['**/*.spec.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@pr-review/*', '!@pr-review/index'], message: stateMessage },
            { group: ['@tasks/*', '@kanban/*'], message: stateMessage },
            { group: ['@core/layout/*'], message: stateMessage },
          ],
        },
      ],
    },
  },
  // tasks no conoce a ningún otro módulo de negocio (el kanban depende de él, no al revés).
  {
    files: ['src/app/tasks/**/*.ts'],
    ignores: ['**/*.spec.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@kanban/*', '@pr-review/*'], message: stateMessage },
            { group: ['@ai-agents/*', '!@ai-agents/index'], message: stateMessage },
            { group: ['@core/layout/*'], message: stateMessage },
          ],
        },
      ],
    },
  },
  // kanban solo toca a tasks por su API pública (@tasks/index).
  {
    files: ['src/app/kanban/**/*.ts'],
    ignores: ['**/*.spec.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@tasks/*', '!@tasks/index'], message: stateMessage },
            { group: ['@pr-review/*', '@ai-agents/*'], message: stateMessage },
            { group: ['@core/layout/*'], message: stateMessage },
          ],
        },
      ],
    },
  },
);
