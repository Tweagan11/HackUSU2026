import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as net from 'net';
import * as fs from 'fs';
import WebSocket from 'ws';

/* ------------------------------------------------------------------ */
/*  Module-level state                                                 */
/* ------------------------------------------------------------------ */

let serverProcess: cp.ChildProcess | null = null;
let currentPanel: vscode.WebviewPanel | null = null;
let panelLockEnabled = false;
let lastServerUrl: string | null = null;
let lastAutoTriggerAt = 0;
let backendWs: WebSocket | null = null;
let persistedPanelState: PersistedPanelState | null = null;
let lastChallenge: ChallengePayload | null = null;
let challengeSendCount = 0;
const MAX_CHALLENGE_SENDS = 5;
let workflowInFlight = false;
let lastBugLocations: BugLocation[] = [];

const AUTO_TRIGGER_DEBOUNCE_MS = 1500;
const PANEL_STATE_KEY = 'codeSergeant.panelState';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface DrillState {
  animation: string;
  successCriteria: number;
  isComplete: boolean;
  message: string;
  updatedAt: string | null;
}

interface BugLocation {
  file: string;
  line_number: number | null;
  description: string;
}

interface ChallengePayload {
  language: string;
  code: string;
  instructions: string;
}

interface StartResponsePayload {
  ok: boolean;
  state: DrillState;
  challenge?: ChallengePayload;
}

interface PersistedPanelState {
  version: 1;
  appState: unknown;
  timeLeftSec: number;
  savedAt: number;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type WebviewMessage = Record<string, any>;
/* eslint-enable @typescript-eslint/no-explicit-any */

/* ------------------------------------------------------------------ */
/*  Activation                                                         */
/* ------------------------------------------------------------------ */

export function activate(context: vscode.ExtensionContext): void {
  persistedPanelState = parsePersistedPanelState(
    context.workspaceState.get(PANEL_STATE_KEY)
  );

  const disposable = vscode.commands.registerCommand(
    'code-sergeant.drill',
    async () => {
      await openSergeantWorkflow(context, 'manual');
    }
  );

  const terminalExecutionListener =
    vscode.window.onDidStartTerminalShellExecution((event) => {
      const commandLine = event.execution.commandLine.value;
      if (!shouldAutoTriggerForCommand(commandLine)) {
        return;
      }
      triggerSergeantIfNeeded(context, `terminal:${commandLine}`);
    });

  const terminalOpenListener = vscode.window.onDidOpenTerminal((terminal) => {
    triggerSergeantIfNeeded(context, `terminal-open:${terminal.name}`);
  });

  const activeTerminalListener = vscode.window.onDidChangeActiveTerminal(
    (terminal) => {
      if (!terminal) {
        return;
      }
      triggerSergeantIfNeeded(context, `terminal-focus:${terminal.name}`);
    }
  );

  const debugSessionListener = vscode.debug.onDidStartDebugSession(() => {
    triggerSergeantIfNeeded(context, 'debug');
  });

  const taskStartListener = vscode.tasks.onDidStartTask((event) => {
    triggerSergeantIfNeeded(context, `task:${event.execution.task.name}`);
  });

  const taskProcessStartListener = vscode.tasks.onDidStartTaskProcess(
    (event) => {
      triggerSergeantIfNeeded(
        context,
        `task-process:${event.execution.task.name}`
      );
    }
  );

  context.subscriptions.push(
    disposable,
    terminalExecutionListener,
    terminalOpenListener,
    activeTerminalListener,
    debugSessionListener,
    taskStartListener,
    taskProcessStartListener
  );
}

/* ------------------------------------------------------------------ */
/*  Workflow entry-point                                               */
/* ------------------------------------------------------------------ */

function triggerSergeantIfNeeded(
  context: vscode.ExtensionContext,
  reason: string
): void {
  const now = Date.now();
  if (now - lastAutoTriggerAt < AUTO_TRIGGER_DEBOUNCE_MS) {
    return;
  }
  lastAutoTriggerAt = now;
  void openSergeantWorkflow(context, reason);
}

async function openSergeantWorkflow(
  context: vscode.ExtensionContext,
  reason: string
): Promise<void> {
  let panelInitializedThisRun = false;
  try {
    // If a locked session is already active, just bring it back.
    // This preserves mission progress when the user closes/reopens.
    if (panelLockEnabled && currentPanel) {
      createOrRevealLockedPanel(context);
      return;
    }

    // Prevent concurrent workflows from racing and killing each other's server.
    if (workflowInFlight) {
      console.log(`[Code Sergeant] Skipping trigger (${reason}) — workflow already in flight`);
      return;
    }
    workflowInFlight = true;

    console.log(`[Code Sergeant] Triggered by ${reason}`);
    await clearPersistedPanelState(context);

    const port = await findAvailablePort();
    const serverUrl = `http://127.0.0.1:${port}`;
    panelLockEnabled = true;
    createOrRevealLockedPanel(context);
    panelInitializedThisRun = true;
    await startServer(context, port);
    await waitForServer(`${serverUrl}/health`);
    const dir = resolveActiveWorkingDirectory();
    const json = { dir };

    const startResponse = await fetch(`${serverUrl}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(json),
    });

    if (!startResponse.ok) {
      throw new Error(
        `Server returned ${startResponse.status} ${startResponse.statusText}`
      );
    }

    const startPayload =
      (await startResponse.json()) as Partial<StartResponsePayload>;
    if (
      !startPayload ||
      typeof startPayload !== 'object' ||
      !startPayload.state ||
      typeof startPayload.state !== 'object'
    ) {
      throw new Error('Server returned an invalid start payload');
    }

    // Challenge will arrive asynchronously via /state polling — clear any stale one
    lastChallenge = null;
    challengeSendCount = 0;
    console.log('[Code Sergeant] Agent running in background, challenge will arrive via WebSocket');

    // Fresh run should start from boot/training flow, not prior mission state.
    lastServerUrl = serverUrl;
    startBackendWebSocket(serverUrl);
  } catch (error) {
    panelLockEnabled = false;
    if (panelInitializedThisRun && currentPanel) {
      currentPanel.dispose();
    }
    workflowInFlight = false;
    stopBackendWebSocket();
    killServer();
    lastServerUrl = null;
    const msg = error instanceof Error ? error.message : String(error);
    void vscode.window.showErrorMessage(
      `Code Sergeant failed to start: ${msg}`
    );
  }
}

async function clearPersistedPanelState(
  context: vscode.ExtensionContext
): Promise<void> {
  persistedPanelState = null;
  await context.workspaceState.update(PANEL_STATE_KEY, undefined);
}

/* ------------------------------------------------------------------ */
/*  Auto-trigger helpers                                               */
/* ------------------------------------------------------------------ */

function shouldAutoTriggerForCommand(rawCommandLine: string): boolean {
  const commandLine = stripLeadingEnvAssignments(rawCommandLine)
    .trim()
    .toLowerCase();
  if (!commandLine) {
    return false;
  }

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

function stripLeadingEnvAssignments(commandLine: string): string {
  let remaining = commandLine.trimStart();
  const envAssignment =
    /^[a-z_][a-z0-9_]*=(?:"[^"]*"|'[^']*'|[^\s]+)\s*/i;
  while (envAssignment.test(remaining)) {
    const match = remaining.match(envAssignment);
    if (!match) {
      break;
    }
    remaining = remaining.slice(match[0].length).trimStart();
  }
  return remaining;
}

function resolveActiveWorkingDirectory(): string | null {
  const activeUri = vscode.window.activeTextEditor?.document.uri;
  if (activeUri) {
    const activeWorkspace = vscode.workspace.getWorkspaceFolder(activeUri);
    if (activeWorkspace) {
      return pathFromUri(activeWorkspace.uri);
    }
    if (activeUri.scheme === 'file') {
      return path.dirname(activeUri.fsPath);
    }
  }

  const fallbackWorkspace = vscode.workspace.workspaceFolders?.[0];
  if (fallbackWorkspace) {
    return pathFromUri(fallbackWorkspace.uri);
  }

  return null;
}

function pathFromUri(uri: vscode.Uri): string {
  return uri.scheme === 'file' ? uri.fsPath : uri.path;
}

function resolveActiveEditorLanguageId(): string {
  const rawLanguageId = vscode.window.activeTextEditor?.document.languageId;
  if (!rawLanguageId) {
    return 'plaintext';
  }

  const mapping: Record<string, string> = {
    javascriptreact: 'javascript',
    typescriptreact: 'typescript',
    shellscript: 'shell',
    c: 'cpp',
    'c++': 'cpp',
    cpp: 'cpp',
    'objective-c': 'objective-c',
    'objective-cpp': 'objective-c',
    csharp: 'csharp',
  };

  return mapping[rawLanguageId] ?? rawLanguageId;
}

/* ------------------------------------------------------------------ */
/*  Python server management                                           */
/* ------------------------------------------------------------------ */

/** Locate a working python3 binary, trying common names. */
function findPython3(): string {
  for (const candidate of ['python3', 'python']) {
    try {
      const result = cp.execFileSync(candidate, ['--version'], {
        encoding: 'utf-8',
        timeout: 5000,
      });
      if (result.startsWith('Python 3')) {
        return candidate;
      }
    } catch {
      // not found — try next
    }
  }
  throw new Error(
    'Could not find Python 3. Please install Python 3.10+ and make sure it is on your PATH.'
  );
}

/** Run a shell command and return its stdout. Rejects on non-zero exit. */
function execAsync(
  cmd: string,
  args: string[],
  cwd: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    cp.execFile(cmd, args, { cwd, timeout: 300_000 }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(`${cmd} ${args.join(' ')} failed:\n${stderr || err.message}`));
      } else {
        resolve(stdout);
      }
    });
  });
}

/**
 * Ensure a virtual-environment exists inside `server/.venv` and that
 * all packages from `server/requirements.txt` are installed.
 *
 * Runs inside `vscode.window.withProgress` so the user sees a spinner.
 */
async function ensureVenv(
  serverDir: string,
  progress: vscode.Progress<{ message?: string }>
): Promise<string> {
  const venvDir = path.join(serverDir, '.venv');
  const isWindows = process.platform === 'win32';
  const venvPython = isWindows
    ? path.join(venvDir, 'Scripts', 'python.exe')
    : path.join(venvDir, 'bin', 'python');

  const requirementsPath = path.join(serverDir, 'requirements.txt');

  // 1. Create venv if it doesn't exist
  if (!fs.existsSync(venvPython)) {
    progress.report({ message: 'Creating Python virtual environment…' });
    const systemPython = findPython3();
    await execAsync(systemPython, ['-m', 'venv', venvDir], serverDir);
    console.log('[Code Sergeant] Created venv at', venvDir);
  }

  // 2. Install / upgrade requirements if the file changed since last install
  const stampFile = path.join(venvDir, '.requirements-stamp');
  const reqContent = fs.readFileSync(requirementsPath, 'utf-8');
  const currentStamp = reqContent.trim();
  let existingStamp = '';
  try {
    existingStamp = fs.readFileSync(stampFile, 'utf-8').trim();
  } catch {
    // stamp doesn't exist yet
  }

  if (currentStamp !== existingStamp) {
    progress.report({ message: 'Installing Python dependencies…' });
    await execAsync(
      venvPython,
      ['-m', 'pip', 'install', '--upgrade', '-q', '-r', requirementsPath],
      serverDir
    );
    fs.writeFileSync(stampFile, currentStamp, 'utf-8');
    console.log('[Code Sergeant] Installed requirements into venv');
  } else {
    console.log('[Code Sergeant] Requirements already up-to-date');
  }

  return venvPython;
}

async function startServer(
  context: vscode.ExtensionContext,
  port: number
): Promise<void> {
  killServer();

  const serverDir = path.join(context.extensionPath, 'server');
  const serverPath = path.join(serverDir, 'main.py');

  // Bootstrap the venv with a visible progress indicator
  const venvPython = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Code Sergeant',
      cancellable: false,
    },
    (progress) => ensureVenv(serverDir, progress)
  );

  serverProcess = cp.spawn(venvPython, [serverPath], {
    cwd: serverDir,
    env: {
      ...process.env,
      CODE_SERGEANT_PORT: String(port),
      PYTHONUNBUFFERED: '1',
      // Make sure the venv's site-packages take priority
      VIRTUAL_ENV: path.join(serverDir, '.venv'),
    },
    stdio: 'pipe',
  });

  serverProcess.stdout?.on('data', (data: Buffer) => {
    const text = data.toString().trimEnd();
    console.log(`[Code Sergeant server] ${text}`);

    // Surface ngrok URL to the user when it appears
    const ngrokMatch = text.match(/\[ngrok\] Public URL: (\S+)/);
    if (ngrokMatch) {
      void vscode.window.showInformationMessage(
        `Code Sergeant ngrok tunnel: ${ngrokMatch[1]}`
      );
    }

    // Surface ngrok errors
    const ngrokErr = text.match(/\[ngrok\] Could not start tunnel: (.+)/);
    if (ngrokErr) {
      void vscode.window.showWarningMessage(
        `Code Sergeant: ngrok failed — ${ngrokErr[1]}`
      );
    }
  });

  serverProcess.stderr?.on('data', (data: Buffer) => {
    console.error(`[Code Sergeant server] ${data.toString().trimEnd()}`);
  });

  serverProcess.on('error', (err: Error) => {
    console.error('[Code Sergeant server] process error:', err);
  });

  serverProcess.on('exit', (code: number | null, signal: string | null) => {
    console.error(
      `[Code Sergeant server] exited (code=${code}, signal=${signal})`
    );
    if (code !== 0 && code !== null) {
      void vscode.window.showErrorMessage(
        `Code Sergeant server exited unexpectedly (code ${code}). Check Output for details.`
      );
    }
  });
}

async function findAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      srv.close((err) => {
        if (err) {
          reject(err);
          return;
        }
        if (!port) {
          reject(new Error('Failed to find an open port'));
          return;
        }
        resolve(port);
      });
    });
  });
}

/* ------------------------------------------------------------------ */
/*  Webview panel                                                      */
/* ------------------------------------------------------------------ */

function createOrRevealLockedPanel(
  context: vscode.ExtensionContext
): void {
  if (currentPanel) {
    currentPanel.reveal(vscode.ViewColumn.Active);
    return;
  }

  currentPanel = vscode.window.createWebviewPanel(
    'codeSergeant',
    'Code Sergeant',
    vscode.ViewColumn.Active,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        vscode.Uri.joinPath(context.extensionUri, 'media'),
      ],
    }
  );

  currentPanel.webview.html = getWebviewHtml(
    currentPanel.webview,
    context.extensionUri,
    persistedPanelState,
    resolveActiveEditorLanguageId()
  );

  currentPanel.webview.onDidReceiveMessage(
    (message: WebviewMessage) => void handleWebviewMessage(message, context)
  );

  currentPanel.onDidDispose(() => {
    currentPanel = null;
    if (panelLockEnabled) {
      setTimeout(() => createOrRevealLockedPanel(context), 50);
      return;
    }
    workflowInFlight = false;
    stopBackendWebSocket();
    killServer();
  });
}

/* ------------------------------------------------------------------ */
/*  Message handler (extracted for clarity)                            */
/* ------------------------------------------------------------------ */

async function handleWebviewMessage(
  message: WebviewMessage,
  context: vscode.ExtensionContext
): Promise<void> {
  // --- CLOSE_PANEL: user completed the mission and wants to exit ---
  if (message.type === 'CLOSE_PANEL') {
    // Capture bug locations before tearing down
    const bugLocs = [...lastBugLocations];
    panelLockEnabled = false;
    workflowInFlight = false;
    stopBackendWebSocket();
    killServer();
    if (currentPanel) {
      currentPanel.dispose();
    }
    // Navigate to the original buggy line so the user can apply their knowledge
    void navigateToBugLocation(bugLocs);
    lastBugLocations = [];
    return;
  }

  // --- SAVE_STATE ---
  if (message.type === 'SAVE_STATE') {
    const state = parsePersistedPanelState(message.payload);
    if (state) {
      persistedPanelState = state;
      void context.workspaceState.update(PANEL_STATE_KEY, state);
    }
    return;
  }

  // --- WEBVIEW_READY: send cached challenge when webview is loaded ---
  // NOTE: This must be checked BEFORE the !lastServerUrl guard so the
  // webview always receives the cached challenge, even in edge cases
  // where lastServerUrl hasn't been set yet.
  if (message.type === 'WEBVIEW_READY') {
    console.log('[Code Sergeant] WEBVIEW_READY received. lastChallenge =', JSON.stringify(lastChallenge));
    if (lastChallenge && currentPanel) {
      console.log('[Code Sergeant] Sending CHALLENGE_LOADED to webview');
      currentPanel.webview.postMessage({
        type: 'CHALLENGE_LOADED',
        challenge: lastChallenge,
      });
    } else {
      console.log('[Code Sergeant] No challenge to send (lastChallenge is null)');
    }
    return;
  }

  if (!lastServerUrl) {
    return;
  }

  const serverUrl = lastServerUrl;

  // --- SUBMIT_CODE ---
  if (message.type === 'SUBMIT_CODE') {
    try {
      const code: string = message.payload?.code ?? '';
      const resp = await fetch(`${serverUrl}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, response: code }),
      });
      if (!resp.ok) {
        throw new Error(`Submit failed: ${resp.status} ${resp.statusText}`);
      }
      const payload = (await resp.json()) as {
        ok: boolean;
        is_correct?: boolean;
        feedback?: string;
        state?: DrillState;
      };
      if (payload.is_correct) {
        currentPanel?.webview.postMessage({
          type: 'RESULT_PASS',
          message: payload.feedback ?? 'Mission complete. Outstanding work, soldier.',
        });
      } else {
        currentPanel?.webview.postMessage({
          type: 'RESULT_FAIL',
          message: payload.feedback ?? 'Incorrect. Try again, recruit.',
        });
      }
    } catch (err) {
      currentPanel?.webview.postMessage({
        type: 'RESULT_FAIL',
        message: err instanceof Error ? err.message : 'Failed to submit code to backend.',
      });
    }
    return;
  }

  // --- MISSION_TIMEOUT ---
  if (message.type === 'MISSION_TIMEOUT') {
    try {
      const resp = await fetch(`${serverUrl}/timeout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!resp.ok) {
        throw new Error(`Timeout failed: ${resp.status} ${resp.statusText}`);
      }
      const payload = (await resp.json()) as {
        message?: string;
        punishment?: string;
      };
      currentPanel?.webview.postMessage({
        type: 'RESULT_FAIL',
        message: payload.message ?? 'Time expired.',
        punishment: payload.punishment,
      });
    } catch {
      currentPanel?.webview.postMessage({
        type: 'RESULT_FAIL',
        message: 'Time expired. Punishment protocol unavailable.',
        punishment: 'DROP AND GIVE ME 20 SEMICOLONS!',
      });
    }
    return;
  }

  // --- CALL_SERGEANT ---
  if (message.type === 'CALL_SERGEANT') {
    const phoneNumber: string = message.payload?.phoneNumber ?? '';
    const callContext = message.payload?.context ?? {};
    try {
      const resp = await fetch(`${serverUrl}/call/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number: phoneNumber,
          context: {
            bug_type: callContext.bugType ?? 'unknown bug',
            fail_count: callContext.failCount ?? 0,
            last_error: callContext.lastError ?? 'N/A',
          },
        }),
      });

      const payload = (await resp.json()) as {
        ok: boolean;
        call_id?: string;
        error?: string;
        details?: unknown;
      };

      if (payload.ok && payload.call_id) {
        currentPanel?.webview.postMessage({
          type: 'CALL_INITIATED',
          callId: payload.call_id,
        });
        pollCallStatus(payload.call_id);
      } else {
        currentPanel?.webview.postMessage({
          type: 'CALL_ERROR',
          message: payload.error ?? 'Failed to initiate call.',
        });
      }
    } catch (err) {
      currentPanel?.webview.postMessage({
        type: 'CALL_ERROR',
        message:
          err instanceof Error
            ? err.message
            : 'Failed to connect to call service.',
      });
    }
    return;
  }

  // --- Legacy "submit" format ---
  if (message.type === 'submit') {
    try {
      const resp = await fetch(`${serverUrl}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: message.payload ?? '' }),
      });
      if (!resp.ok) {
        throw new Error(`Submit failed: ${resp.status} ${resp.statusText}`);
      }
    } catch {
      currentPanel?.webview.postMessage({
        type: 'error',
        payload: { message: 'Failed to submit response to backend.' },
      });
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Webview HTML                                                       */
/* ------------------------------------------------------------------ */

function getWebviewHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  initialState: PersistedPanelState | null,
  editorLanguage: string
): string {
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'media', 'webview.js')
  );
  const nonce = getNonce();
  const serializedInitialState = JSON.stringify(initialState ?? null).replace(
    /</g,
    '\\u003c'
  );
  const serializedEditorLanguage = JSON.stringify(editorLanguage ?? 'plaintext').replace(
    /</g,
    '\\u003c'
  );

  return /* html */ `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <meta
    http-equiv="Content-Security-Policy"
    content="default-src 'none';
      script-src 'nonce-${nonce}' ${webview.cspSource};
      style-src 'unsafe-inline';
      img-src ${webview.cspSource} data:;
      font-src ${webview.cspSource} data:;
      worker-src blob:;"
  />
  <style>
    body, html { margin: 0; padding: 0; height: 100vh; overflow: hidden; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}">
    window.__CODE_SERGEANT_INITIAL_STATE__ = ${serializedInitialState};
    window.__CODE_SERGEANT_EDITOR_LANGUAGE__ = ${serializedEditorLanguage};
  </script>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

/* ------------------------------------------------------------------ */
/*  Navigate to original bug location after mission complete           */
/* ------------------------------------------------------------------ */

/**
 * After the recruit passes the mission, open the original file that
 * contained the bug and place the cursor on the problematic line.
 * If multiple bugs were found, navigate to the first one.
 */
async function navigateToBugLocation(bugLocations: BugLocation[]): Promise<void> {
  if (!bugLocations.length) {
    return;
  }

  const bug = bugLocations[0];
  const filePath = bug.file;
  const lineNumber = bug.line_number ?? 1;
  const description = bug.description ?? '';

  // Try to find the file in the workspace
  const files = await vscode.workspace.findFiles(`**/${filePath}`, '**/node_modules/**', 5);
  if (!files.length) {
    // Fallback: show a message with the location instead
    void vscode.window.showInformationMessage(
      `🎖️ Bug was in ${filePath} at line ${lineNumber}: ${description}`
    );
    return;
  }

  try {
    const doc = await vscode.workspace.openTextDocument(files[0]);
    const editor = await vscode.window.showTextDocument(doc, vscode.ViewColumn.Active);

    // Place cursor on the buggy line and reveal it in the center of the editor
    const line = Math.max(0, lineNumber - 1); // VS Code lines are 0-indexed
    const range = new vscode.Range(line, 0, line, 0);
    editor.selection = new vscode.Selection(range.start, range.start);
    editor.revealRange(range, vscode.TextEditorRevealType.InCenter);

    // Highlight the line briefly with a decoration
    const decoration = vscode.window.createTextEditorDecorationType({
      backgroundColor: 'rgba(255, 90, 90, 0.3)',
      isWholeLine: true,
      border: '1px solid rgba(255, 90, 90, 0.6)',
      after: {
        contentText: `  ← Bug was here: ${description}`,
        color: 'rgba(255, 200, 100, 0.8)',
        fontStyle: 'italic',
      },
    });
    editor.setDecorations(decoration, [range]);

    // Remove the decoration after 15 seconds
    setTimeout(() => decoration.dispose(), 15_000);

    void vscode.window.showInformationMessage(
      `🎖️ Now fix the real bug! ${filePath}:${lineNumber} — ${description}`
    );
  } catch (err) {
    console.error('[Code Sergeant] Failed to navigate to bug:', err);
    void vscode.window.showInformationMessage(
      `🎖️ Bug was in ${filePath} at line ${lineNumber}: ${description}`
    );
  }
}

/* ------------------------------------------------------------------ */
/*  State persistence helpers                                          */
/* ------------------------------------------------------------------ */

function parsePersistedPanelState(
  value: unknown
): PersistedPanelState | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const candidate = value as Partial<PersistedPanelState>;
  if (candidate.version !== 1) {
    return null;
  }
  if (
    typeof candidate.appState !== 'object' ||
    candidate.appState === null
  ) {
    return null;
  }
  if (
    typeof candidate.timeLeftSec !== 'number' ||
    !Number.isFinite(candidate.timeLeftSec)
  ) {
    return null;
  }
  if (
    typeof candidate.savedAt !== 'number' ||
    !Number.isFinite(candidate.savedAt)
  ) {
    return null;
  }
  return {
    version: 1,
    appState: candidate.appState,
    timeLeftSec: Math.max(0, Math.floor(candidate.timeLeftSec)),
    savedAt: candidate.savedAt,
  };
}

/* ------------------------------------------------------------------ */
/*  Backend real-time stream (WebSocket — instant push updates)         */
/* ------------------------------------------------------------------ */

/**
 * Connects to the backend `/ws` WebSocket endpoint.
 * The server pushes state updates immediately when they happen,
 * so there is zero polling delay.
 */
function startBackendWebSocket(serverUrl: string): void {
  stopBackendWebSocket();

  const wsUrl = serverUrl.replace(/^http/, 'ws') + '/ws';
  console.log(`[Code Sergeant] Connecting WebSocket to ${wsUrl}`);

  const ws = new WebSocket(wsUrl);
  backendWs = ws;

  ws.on('open', () => {
    console.log('[Code Sergeant] WebSocket connected');
  });

  ws.on('message', (data: WebSocket.Data) => {
    try {
      const payload = JSON.parse(data.toString()) as Record<string, unknown>;

      // Detect challenge arriving from the background agent run.
      // Re-send up to MAX_CHALLENGE_SENDS times to handle cases where
      // the webview's message listener wasn't ready on the first delivery.
      if (payload.challenge) {
        const challenge = payload.challenge as ChallengePayload;
        // Capture original bug locations for post-mission navigation
        if (Array.isArray(payload.bug_locations)) {
          lastBugLocations = payload.bug_locations as BugLocation[];
          console.log('[Code Sergeant] Bug locations:', JSON.stringify(lastBugLocations));
        }
        if (!lastChallenge) {
          lastChallenge = challenge;
          challengeSendCount = 0;
          console.log('[Code Sergeant] Challenge arrived via WebSocket:', JSON.stringify(challenge));
        }
        if (challengeSendCount < MAX_CHALLENGE_SENDS) {
          challengeSendCount++;
          console.log(`[Code Sergeant] Sending CHALLENGE_LOADED to webview (attempt ${challengeSendCount}/${MAX_CHALLENGE_SENDS})`);
          currentPanel?.webview.postMessage({
            type: 'CHALLENGE_LOADED',
            challenge,
          });
        }
      }

      // If the backend signals an error, relay to the front-end
      if (payload.animation === 'error' && typeof payload.message === 'string') {
        currentPanel?.webview.postMessage({
          type: 'RESULT_FAIL',
          message: payload.message,
        });
      }

      // If the backend signals completion, relay to the front-end
      if (payload.isComplete === true) {
        currentPanel?.webview.postMessage({
          type: 'RESULT_PASS',
          message:
            (typeof payload.message === 'string' && payload.message) ||
            'Analysis complete.',
        });
      }

      // Also relay as legacy update
      currentPanel?.webview.postMessage({ type: 'update', payload });
    } catch {
      // Ignore malformed messages
    }
  });

  ws.on('close', () => {
    console.log('[Code Sergeant] WebSocket closed');
    backendWs = null;
  });

  ws.on('error', (err: Error) => {
    console.error('[Code Sergeant] WebSocket error:', err.message);
    // If the connection fails, attempt a reconnect after a brief delay
    backendWs = null;
    if (lastServerUrl) {
      setTimeout(() => {
        if (lastServerUrl) {
          startBackendWebSocket(lastServerUrl);
        }
      }, 2000);
    }
  });
}

function stopBackendWebSocket(): void {
  if (backendWs) {
    backendWs.close();
    backendWs = null;
  }
}

/* ------------------------------------------------------------------ */
/*  Call status polling                                                 */
/* ------------------------------------------------------------------ */

/**
 * Poll the backend for call status updates.
 * Sends CALL_IN_PROGRESS / CALL_ENDED to the webview.
 * Stops after the call ends or ~2 minutes.
 */
function pollCallStatus(callId: string): void {
  if (!lastServerUrl) {
    return;
  }

  const serverUrl = lastServerUrl;
  let attempts = 0;
  const maxAttempts = 40; // ~2 min at 3 s intervals
  const intervalMs = 3000;

  const interval = setInterval(async () => {
    attempts++;
    if (attempts > maxAttempts || !lastServerUrl) {
      clearInterval(interval);
      return;
    }

    try {
      const resp = await fetch(`${serverUrl}/call/status/${callId}`);
      if (!resp.ok) {
        clearInterval(interval);
        return;
      }

      const data = (await resp.json()) as {
        ok: boolean;
        status?: string;
      };
      if (!data.ok) {
        clearInterval(interval);
        return;
      }

      if (
        data.status === 'in-progress' ||
        data.status === 'in_progress'
      ) {
        currentPanel?.webview.postMessage({ type: 'CALL_IN_PROGRESS' });
      } else if (data.status === 'ended') {
        currentPanel?.webview.postMessage({ type: 'CALL_ENDED' });
        clearInterval(interval);
      }
    } catch {
      // Silently continue polling on transient failures
    }
  }, intervalMs);
}

/* ------------------------------------------------------------------ */
/*  Server health-check                                                */
/* ------------------------------------------------------------------ */

async function waitForServer(
  url: string,
  retries = 20,
  delay = 500
): Promise<void> {
  for (let i = 0; i < retries; i++) {
    if (serverProcess && serverProcess.exitCode !== null) {
      throw new Error(
        `Python server exited early with code ${serverProcess.exitCode}`
      );
    }
    try {
      const resp = await fetch(url);
      if (resp.ok) {
        // Log the full health payload (includes ngrok state)
        try {
          const body = (await resp.json()) as Record<string, unknown>;
          console.log('[Code Sergeant] Server healthy:', JSON.stringify(body));
          const ngrok = body.ngrok as Record<string, unknown> | undefined;
          if (ngrok && !ngrok.running && ngrok.error) {
            void vscode.window.showWarningMessage(
              `Code Sergeant: ngrok tunnel is NOT running \u2014 ${ngrok.error}`
            );
          }
        } catch { /* json parse is best-effort */ }
        return;
      }
    } catch {
      // keep retrying
    }
    await new Promise((r) => setTimeout(r, delay));
  }
  throw new Error('Server did not start in time');
}

/* ------------------------------------------------------------------ */
/*  Cleanup helpers                                                    */
/* ------------------------------------------------------------------ */

function killServer(): void {
  if (serverProcess) {
    if (serverProcess.exitCode === null) {
      serverProcess.kill();
    }
    serverProcess = null;
  }
  lastServerUrl = null;
}

function getNonce(): string {
  const possible =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let text = '';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

/* ------------------------------------------------------------------ */
/*  Deactivation                                                       */
/* ------------------------------------------------------------------ */

export function deactivate(): void {
  panelLockEnabled = false;
  workflowInFlight = false;
  if (currentPanel) {
    currentPanel.dispose();
    currentPanel = null;
  }
  stopBackendWebSocket();
  killServer();
}
