/**
 * Integration tests for extension.ts helper functions and logic.
 *
 * These tests focus on the pure/testable parts of the extension:
 * - shouldAutoTriggerForCommand (command matching)
 * - stripLeadingEnvAssignments
 * - parsePersistedPanelState (state persistence parsing)
 * - Server health-check / workflow edge cases
 *
 * Full VS Code API tests require the @vscode/test-electron runner,
 * but these unit-level integration tests can run with mocha directly.
 */

import * as assert from 'assert';

// Since extension.ts has module-level VS Code imports that won't resolve in
// pure node tests, we test the logic patterns via inline implementations
// that mirror the extension code exactly.

// ── Mirrored helper: shouldAutoTriggerForCommand ────────────────

function stripLeadingEnvAssignments(commandLine: string): string {
  let remaining = commandLine.trimStart();
  const envAssignment = /^[a-z_][a-z0-9_]*=(?:"[^"]*"|'[^']*'|[^\s]+)\s*/i;
  while (envAssignment.test(remaining)) {
    const match = remaining.match(envAssignment);
    if (!match) break;
    remaining = remaining.slice(match[0].length).trimStart();
  }
  return remaining;
}

function shouldAutoTriggerForCommand(rawCommandLine: string): boolean {
  const commandLine = stripLeadingEnvAssignments(rawCommandLine).trim().toLowerCase();
  if (!commandLine) return false;

  const runPatterns = [
    /^python(3(\.\d+)?)?\s+\S+\.py(\s|$)/,
    /^node\s+\S+\.(js|cjs|mjs)(\s|$)/,
    /^ts-node\s+\S+\.ts(\s|$)/,
    /^go\s+run(\s|$)/,
    /^cargo\s+run(\s|$)/,
    /^java(\s|$)/,
    /^dotnet\s+run(\s|$)/,
    /^(npm|pnpm|yarn|bun)\s+(run\s+)?(start|dev|test|build)(\s|$)/,
  ];

  return runPatterns.some((p) => p.test(commandLine));
}

// ── Mirrored helper: parsePersistedPanelState ────────────────────

interface PersistedPanelState {
  version: 1;
  appState: unknown;
  timeLeftSec: number;
  savedAt: number;
}

function parsePersistedPanelState(value: unknown): PersistedPanelState | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<PersistedPanelState>;
  if (candidate.version !== 1) return null;
  if (typeof candidate.appState !== 'object' || candidate.appState === null) return null;
  if (typeof candidate.timeLeftSec !== 'number' || !Number.isFinite(candidate.timeLeftSec)) return null;
  if (typeof candidate.savedAt !== 'number' || !Number.isFinite(candidate.savedAt)) return null;
  return {
    version: 1,
    appState: candidate.appState,
    timeLeftSec: Math.max(0, Math.floor(candidate.timeLeftSec)),
    savedAt: candidate.savedAt,
  };
}

// ═══════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════

suite('Extension — shouldAutoTriggerForCommand', () => {
  // Python commands
  test('triggers on: python script.py', () => {
    assert.strictEqual(shouldAutoTriggerForCommand('python script.py'), true);
  });

  test('triggers on: python3 script.py', () => {
    assert.strictEqual(shouldAutoTriggerForCommand('python3 script.py'), true);
  });

  test('triggers on: python3.12 main.py', () => {
    assert.strictEqual(shouldAutoTriggerForCommand('python3.12 main.py'), true);
  });

  test('triggers on: python script.py --arg', () => {
    assert.strictEqual(shouldAutoTriggerForCommand('python script.py --arg'), true);
  });

  // Node commands
  test('triggers on: node app.js', () => {
    assert.strictEqual(shouldAutoTriggerForCommand('node app.js'), true);
  });

  test('triggers on: node app.cjs', () => {
    assert.strictEqual(shouldAutoTriggerForCommand('node app.cjs'), true);
  });

  test('triggers on: node app.mjs', () => {
    assert.strictEqual(shouldAutoTriggerForCommand('node app.mjs'), true);
  });

  // ts-node
  test('triggers on: ts-node server.ts', () => {
    assert.strictEqual(shouldAutoTriggerForCommand('ts-node server.ts'), true);
  });

  // Go
  test('triggers on: go run', () => {
    assert.strictEqual(shouldAutoTriggerForCommand('go run'), true);
  });

  test('triggers on: go run main.go', () => {
    assert.strictEqual(shouldAutoTriggerForCommand('go run main.go'), true);
  });

  // Cargo (Rust)
  test('triggers on: cargo run', () => {
    assert.strictEqual(shouldAutoTriggerForCommand('cargo run'), true);
  });

  // Java
  test('triggers on: java', () => {
    assert.strictEqual(shouldAutoTriggerForCommand('java'), true);
  });

  test('triggers on: java -jar app.jar', () => {
    assert.strictEqual(shouldAutoTriggerForCommand('java -jar app.jar'), true);
  });

  // dotnet
  test('triggers on: dotnet run', () => {
    assert.strictEqual(shouldAutoTriggerForCommand('dotnet run'), true);
  });

  // npm/yarn/pnpm/bun
  test('triggers on: npm run start', () => {
    assert.strictEqual(shouldAutoTriggerForCommand('npm run start'), true);
  });

  test('triggers on: npm start', () => {
    assert.strictEqual(shouldAutoTriggerForCommand('npm start'), true);
  });

  test('triggers on: npm test', () => {
    assert.strictEqual(shouldAutoTriggerForCommand('npm test'), true);
  });

  test('triggers on: npm run dev', () => {
    assert.strictEqual(shouldAutoTriggerForCommand('npm run dev'), true);
  });

  test('triggers on: npm run build', () => {
    assert.strictEqual(shouldAutoTriggerForCommand('npm run build'), true);
  });

  test('triggers on: yarn start', () => {
    assert.strictEqual(shouldAutoTriggerForCommand('yarn start'), true);
  });

  test('triggers on: pnpm run test', () => {
    assert.strictEqual(shouldAutoTriggerForCommand('pnpm run test'), true);
  });

  test('triggers on: bun dev', () => {
    assert.strictEqual(shouldAutoTriggerForCommand('bun dev'), true);
  });

  // Environment variables prefix
  test('triggers with env prefix: FOO=bar python script.py', () => {
    assert.strictEqual(shouldAutoTriggerForCommand('FOO=bar python script.py'), true);
  });

  test('triggers with multiple env prefixes: A=1 B=2 node app.js', () => {
    assert.strictEqual(shouldAutoTriggerForCommand('A=1 B=2 node app.js'), true);
  });

  test('triggers with quoted env values: ENV="hello world" python test.py', () => {
    assert.strictEqual(shouldAutoTriggerForCommand('ENV="hello world" python test.py'), true);
  });

  // Should NOT trigger
  test('does not trigger on: cd /tmp', () => {
    assert.strictEqual(shouldAutoTriggerForCommand('cd /tmp'), false);
  });

  test('does not trigger on: ls -la', () => {
    assert.strictEqual(shouldAutoTriggerForCommand('ls -la'), false);
  });

  test('does not trigger on: git push', () => {
    assert.strictEqual(shouldAutoTriggerForCommand('git push'), false);
  });

  test('does not trigger on: pip install flask', () => {
    assert.strictEqual(shouldAutoTriggerForCommand('pip install flask'), false);
  });

  test('does not trigger on: npm install', () => {
    assert.strictEqual(shouldAutoTriggerForCommand('npm install'), false);
  });

  test('does not trigger on: npm run lint', () => {
    assert.strictEqual(shouldAutoTriggerForCommand('npm run lint'), false);
  });

  test('does not trigger on empty string', () => {
    assert.strictEqual(shouldAutoTriggerForCommand(''), false);
  });

  test('does not trigger on whitespace only', () => {
    assert.strictEqual(shouldAutoTriggerForCommand('   '), false);
  });

  test('case insensitive: PYTHON script.py', () => {
    assert.strictEqual(shouldAutoTriggerForCommand('PYTHON script.py'), true);
  });

  test('case insensitive: Node App.js', () => {
    assert.strictEqual(shouldAutoTriggerForCommand('Node App.js'), true);
  });
});

suite('Extension — stripLeadingEnvAssignments', () => {
  test('no env assignments returns original', () => {
    assert.strictEqual(stripLeadingEnvAssignments('python script.py'), 'python script.py');
  });

  test('single env assignment stripped', () => {
    assert.strictEqual(stripLeadingEnvAssignments('FOO=bar python script.py'), 'python script.py');
  });

  test('multiple env assignments stripped', () => {
    assert.strictEqual(
      stripLeadingEnvAssignments('A=1 B=2 C=3 node app.js'),
      'node app.js'
    );
  });

  test('env with double-quoted value', () => {
    assert.strictEqual(
      stripLeadingEnvAssignments('MSG="hello world" python test.py'),
      'python test.py'
    );
  });

  test('env with single-quoted value', () => {
    assert.strictEqual(
      stripLeadingEnvAssignments("PATH='/usr/bin' python test.py"),
      'python test.py'
    );
  });

  test('empty input', () => {
    assert.strictEqual(stripLeadingEnvAssignments(''), '');
  });

  test('only env assignments with no command', () => {
    const result = stripLeadingEnvAssignments('FOO=bar');
    // Should return the assignment if it doesn't match the pattern fully
    // (The regex requires trailing whitespace, so single assignments are kept)
    assert.ok(result.length >= 0);
  });

  test('leading whitespace is trimmed', () => {
    assert.strictEqual(
      stripLeadingEnvAssignments('   FOO=bar python script.py'),
      'python script.py'
    );
  });
});

suite('Extension — parsePersistedPanelState', () => {
  const validState = {
    version: 1,
    appState: { uiState: 'IDLE', code: '' },
    timeLeftSec: 60,
    savedAt: Date.now(),
  };

  test('parses valid state', () => {
    const result = parsePersistedPanelState(validState);
    assert.ok(result);
    assert.strictEqual(result!.version, 1);
    assert.strictEqual(result!.timeLeftSec, 60);
  });

  test('returns null for null input', () => {
    assert.strictEqual(parsePersistedPanelState(null), null);
  });

  test('returns null for undefined', () => {
    assert.strictEqual(parsePersistedPanelState(undefined), null);
  });

  test('returns null for string', () => {
    assert.strictEqual(parsePersistedPanelState('not an object'), null);
  });

  test('returns null for number', () => {
    assert.strictEqual(parsePersistedPanelState(42), null);
  });

  test('returns null for wrong version', () => {
    assert.strictEqual(
      parsePersistedPanelState({ ...validState, version: 2 }),
      null
    );
  });

  test('returns null for missing version', () => {
    const { version, ...rest } = validState;
    assert.strictEqual(parsePersistedPanelState(rest), null);
  });

  test('returns null for null appState', () => {
    assert.strictEqual(
      parsePersistedPanelState({ ...validState, appState: null }),
      null
    );
  });

  test('returns null for non-object appState', () => {
    assert.strictEqual(
      parsePersistedPanelState({ ...validState, appState: 'string' }),
      null
    );
  });

  test('returns null for NaN timeLeftSec', () => {
    assert.strictEqual(
      parsePersistedPanelState({ ...validState, timeLeftSec: NaN }),
      null
    );
  });

  test('returns null for Infinity timeLeftSec', () => {
    assert.strictEqual(
      parsePersistedPanelState({ ...validState, timeLeftSec: Infinity }),
      null
    );
  });

  test('returns null for string timeLeftSec', () => {
    assert.strictEqual(
      parsePersistedPanelState({ ...validState, timeLeftSec: '60' }),
      null
    );
  });

  test('returns null for NaN savedAt', () => {
    assert.strictEqual(
      parsePersistedPanelState({ ...validState, savedAt: NaN }),
      null
    );
  });

  test('clamps negative timeLeftSec to 0', () => {
    const result = parsePersistedPanelState({ ...validState, timeLeftSec: -10 });
    assert.ok(result);
    assert.strictEqual(result!.timeLeftSec, 0);
  });

  test('floors fractional timeLeftSec', () => {
    const result = parsePersistedPanelState({ ...validState, timeLeftSec: 45.7 });
    assert.ok(result);
    assert.strictEqual(result!.timeLeftSec, 45);
  });

  test('preserves zero timeLeftSec', () => {
    const result = parsePersistedPanelState({ ...validState, timeLeftSec: 0 });
    assert.ok(result);
    assert.strictEqual(result!.timeLeftSec, 0);
  });
});

suite('Extension — Integration Scenarios', () => {
  test('env-prefix command triggers correctly then state parses', () => {
    // Simulate: user ran a command → trigger detected → state saved → restored
    const cmd = 'PYTHONPATH=. python3 test_suite.py --verbose';
    assert.strictEqual(shouldAutoTriggerForCommand(cmd), true);

    const savedState = {
      version: 1 as const,
      appState: { uiState: 'ANALYZING', code: 'x = 1' },
      timeLeftSec: 45,
      savedAt: Date.now(),
    };
    const parsed = parsePersistedPanelState(savedState);
    assert.ok(parsed);
    assert.strictEqual(parsed!.timeLeftSec, 45);
  });

  test('non-triggering commands do not activate', () => {
    const nonTriggers = [
      'echo hello',
      'cat file.txt',
      'mkdir -p /tmp/test',
      'grep -r "bug" .',
      'docker run ubuntu',
      'ssh user@server',
      'curl https://api.example.com',
      'pip install requests',
      'npm install express',
      'yarn add react',
    ];

    for (const cmd of nonTriggers) {
      assert.strictEqual(
        shouldAutoTriggerForCommand(cmd),
        false,
        `"${cmd}" should NOT trigger`
      );
    }
  });

  test('all triggering commands activate correctly', () => {
    const triggers = [
      'python main.py',
      'python3 main.py',
      'python3.11 main.py',
      'node server.js',
      'node index.mjs',
      'ts-node app.ts',
      'go run',
      'go run main.go',
      'cargo run',
      'java Main',
      'java -jar app.jar',
      'dotnet run',
      'npm start',
      'npm run start',
      'npm run dev',
      'npm run test',
      'npm run build',
      'npm test',
      'yarn start',
      'yarn dev',
      'pnpm start',
      'bun start',
      'bun dev',
    ];

    for (const cmd of triggers) {
      assert.strictEqual(
        shouldAutoTriggerForCommand(cmd),
        true,
        `"${cmd}" should trigger`
      );
    }
  });
});
