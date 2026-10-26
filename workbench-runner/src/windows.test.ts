import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { tempDir } from './test-helpers';
import {
  LAUNCHER_FILE,
  STARTUP_FILE,
  install,
  launcherScript,
  protocolCommand,
  registryAdds,
  remove,
  userStartupDir,
  vbsLiteral,
} from './windows';

const RUNNER_DIR = 'C:\\Users\\Ana Pérez\\workbench\\workbench-runner';
const NODE = 'C:\\Program Files\\nodejs\\node.exe';

describe('vbsLiteral', () => {
  it('doubles the quotes', () => {
    assert.equal(vbsLiteral('di "hola"'), '"di ""hola"""');
  });
});

// El script de arranque es de Windows y arma sus rutas con `\`: en Linux (la distro del runner) no aplica.
describe(
  'launcherScript',
  { skip: process.platform !== 'win32' ? 'solo en Windows' : false },
  () => {
    const script = launcherScript(RUNNER_DIR, NODE);

    it('goes to the runner folder, so it finds its configuration', () => {
      assert.match(
        script,
        /shell\.CurrentDirectory = "C:\\Users\\Ana Pérez\\workbench\\workbench-runner"/,
      );
    });

    it('runs node on the runner with the output in runner.log, hidden and without waiting', () => {
      const run = script
        .split('\r\n')
        .find((line) => line.startsWith('shell.Run'))!;

      // Entre comillas de VBScript: cada comilla del comando va duplicada.
      assert.ok(run.includes('cmd /c ""'));
      assert.ok(run.includes('""C:\\Program Files\\nodejs\\node.exe"" '));
      assert.ok(run.includes('dist\\main.js""'));
      assert.ok(
        run.includes(
          '>> ""C:\\Users\\Ana Pérez\\workbench\\workbench-runner\\runner.log"" 2>&1',
        ),
      );
      assert.ok(run.endsWith(', 0, False'));
    });

    it('uses Windows line endings', () => {
      assert.ok(script.includes('\r\n'));
      assert.ok(!/[^\r]\n/.test(script));
    });
  },
);

describe('registry', () => {
  it('opens the launcher when the workbench-runner link is opened', () => {
    const command = protocolCommand('C:\\r\\start-hidden.vbs');
    const adds = registryAdds('workbench-runner', command);

    assert.equal(command, 'wscript.exe //B "C:\\r\\start-hidden.vbs"');
    assert.deepEqual(
      adds.map((args) => args[1]),
      [
        'HKCU\\Software\\Classes\\workbench-runner',
        'HKCU\\Software\\Classes\\workbench-runner',
        'HKCU\\Software\\Classes\\workbench-runner\\shell\\open\\command',
      ],
    );
    assert.ok(adds[1].includes('URL Protocol'));
    assert.equal(adds[2][adds[2].indexOf('/d') + 1], command);
  });

  it('only touches the current user, never the machine', () => {
    for (const args of registryAdds('workbench-runner', 'x')) {
      assert.ok(args[1].startsWith('HKCU\\'));
    }
  });
});

describe('install and remove', () => {
  function setup(dryRun: boolean) {
    const runnerDir = tempDir('runner');
    const startupDir = join(tempDir('startup'), 'Startup');
    const messages: string[] = [];
    return {
      runnerDir,
      startupDir,
      messages,
      options: {
        runnerDir,
        nodePath: NODE,
        startupDir,
        // Una clave solo de prueba, para no tocar la del runner de verdad.
        protocol: 'workbench-runner-prueba',
        dryRun,
        log: (message: string) => messages.push(message),
      },
    };
  }

  it('changes nothing when it is a simulation, and says what it would do', () => {
    const { options, runnerDir, startupDir, messages } = setup(true);

    install(options);
    remove(options);

    assert.equal(existsSync(join(runnerDir, LAUNCHER_FILE)), false);
    assert.equal(existsSync(startupDir), false);
    assert.ok(
      messages.some(
        (m) => m.includes('simulación') && m.includes(STARTUP_FILE),
      ),
    );
    assert.ok(messages.some((m) => m.includes('reg "add"')));
  });

  it(
    'writes the launcher, puts it in startup and registers the link, then removes it all',
    {
      skip: process.platform !== 'win32',
    },
    () => {
      const { options, runnerDir, startupDir } = setup(false);
      mkdirSync(startupDir, { recursive: true });

      try {
        install(options);

        const launcher = readFileSync(join(runnerDir, LAUNCHER_FILE), 'utf8');
        assert.equal(
          readFileSync(join(startupDir, STARTUP_FILE), 'utf8'),
          launcher,
        );
        assert.ok(launcher.includes('shell.Run'));
      } finally {
        remove(options);
      }

      assert.equal(existsSync(join(startupDir, STARTUP_FILE)), false);
    },
  );
});

describe('userStartupDir', () => {
  it('is the Startup folder of the current user', () => {
    assert.equal(
      userStartupDir({ APPDATA: 'C:\\Users\\Ana\\AppData\\Roaming' }),
      join(
        'C:\\Users\\Ana\\AppData\\Roaming',
        'Microsoft',
        'Windows',
        'Start Menu',
        'Programs',
        'Startup',
      ),
    );
  });

  it('says so when APPDATA is missing', () => {
    assert.throws(() => userStartupDir({}), /APPDATA/);
  });
});
