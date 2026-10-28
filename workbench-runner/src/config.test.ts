import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { DEFAULT_CONFIG, effectiveTools, loadConfig } from './config';
import { tempDir } from './test-helpers';

function configFile(content: unknown): string {
  const file = join(tempDir('config'), 'runner.config.json');
  writeFileSync(
    file,
    typeof content === 'string' ? content : JSON.stringify(content),
  );
  return file;
}

const valid = {
  serverUrl: 'http://personal-task-manager:4321/api/',
  token: 'wbr_abc',
  workDir: 'E:\\workbench-agent-repos',
};

describe('effectiveTools', () => {
  it('keeps only what the server asks for and the runner allows', () => {
    assert.deepEqual(
      effectiveTools(['Read', 'Edit', 'Bash(rm:*)'], ['Read', 'Edit', 'Grep']),
      ['Read', 'Edit'],
    );
  });

  it('never adds tools the server did not ask for', () => {
    assert.deepEqual(effectiveTools(['Read'], ['Read', 'Write']), ['Read']);
    assert.deepEqual(effectiveTools([], ['Read']), []);
  });
});

describe('loadConfig', () => {
  it('reads the file and fills in the defaults', () => {
    const config = loadConfig(configFile(valid), {});

    assert.equal(config.serverUrl, 'http://personal-task-manager:4321/api');
    assert.equal(config.token, 'wbr_abc');
    assert.equal(config.claudeBin, 'claude');
    assert.equal(config.maxBudgetUsd, DEFAULT_CONFIG.maxBudgetUsd);
    assert.deepEqual(config.timeoutMinutes, DEFAULT_CONFIG.timeoutMinutes);
    assert.deepEqual(config.allowedTools.develop, [
      ...DEFAULT_CONFIG.allowedTools.develop,
    ]);
  });

  it('lets the environment override the server and the token', () => {
    const config = loadConfig(configFile(valid), {
      WORKBENCH_URL: 'http://otro:1/api',
      WORKBENCH_RUNNER_TOKEN: 'wbr_env',
    });

    assert.equal(config.serverUrl, 'http://otro:1/api');
    assert.equal(config.token, 'wbr_env');
  });

  it('lets the user narrow the tools and the timeouts', () => {
    const config = loadConfig(
      configFile({
        ...valid,
        allowedTools: { develop: ['Read'] },
        timeoutMinutes: { develop: 10 },
      }),
      {},
    );

    assert.deepEqual(config.allowedTools.develop, ['Read']);
    assert.equal(config.timeoutMinutes.develop, 10);
    assert.equal(
      config.timeoutMinutes.review,
      DEFAULT_CONFIG.timeoutMinutes.review,
    );
  });

  it('explains what is wrong', () => {
    assert.throws(
      () => loadConfig(join(tempDir('none'), 'nada.json'), {}),
      /no existe/,
    );
    assert.throws(
      () => loadConfig(configFile('{ no es json'), {}),
      /JSON válido/,
    );
    assert.throws(
      () => loadConfig(configFile({ ...valid, token: 'abc' }), {}),
      /wbr_/,
    );
    assert.throws(
      () => loadConfig(configFile({ ...valid, serverUrl: 'ftp://x' }), {}),
      /http/,
    );
    assert.throws(
      () => loadConfig(configFile({ ...valid, workDir: '' }), {}),
      /workDir/,
    );
    assert.throws(
      () => loadConfig(configFile({ ...valid, maxBudgetUsd: 0 }), {}),
      /maxBudgetUsd/,
    );
  });

  it('only lets a project read from the dependency cache when it has one', () => {
    const web = {
      composeFiles: ['docker-compose.yml'],
      ports: [{ name: 'app', env: 'COMPOSE_PORT' }],
    };
    assert.throws(
      () =>
        loadConfig(
          configFile({
            ...valid,
            environments: {
              'acme/web': { ...web, dependenciesOnlyForReading: true },
            },
          }),
          {},
        ),
      /dependencyCache/,
    );
    assert.doesNotThrow(() =>
      loadConfig(
        configFile({
          ...valid,
          environments: {
            'acme/web': {
              ...web,
              dependenciesOnlyForReading: true,
              dependencyCache: [{ dir: 'vendor', lock: 'composer.lock' }],
            },
          },
        }),
        {},
      ),
    );
  });
});
