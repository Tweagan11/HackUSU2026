import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as net from 'net';

/* ------------------------------------------------------------------ */
/*  Module-level state                                                 */
/* ------------------------------------------------------------------ */

let serverProcess: cp.ChildProcess | null = null;
let currentPanel: vscode.WebviewPanel | null = null;
let panelLockEnabled = false;
let lastServerUrl: string | null = null;
let lastAutoTriggerAt = 0;
let backendPollTimer: ReturnType<typeof setInterval> | null = null;
let persistedPanelState: PersistedPanelState | null = null;

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

interface StartResponsePayload {
  state: DrillState;
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

  const debugSessionListener = vscode.debug.onDidStartDebugSession(() => {
    triggerSergeantIfNeeded(context, 'debug');
  });

  context.subscriptions.push(
    disposable,
    terminalExecutionListener,
    debugSessionListener
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
  try {
    if (currentPanel) {
      // Force a full restart so latest frontend bundle/state is loaded.
      panelLockEnabled = false;
      currentPanel.dispose();
      currentPanel = null;
      stopBackendPolling();
      killServer();
      lastServerUrl = null;
    }

    console.log(`[Code Sergeant] Triggered by ${reason}`);
    const port = await findAvailablePort();
    const serverUrl = `http://127.0.0.1:${port}`;
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

    await clearPersistedPanelState(context);
    panelLockEnabled = true;
    lastServerUrl = serverUrl;
    createOrRevealLockedPanel(context);
    startBackendPolling(serverUrl);
  } catch (error) {
    panelLockEnabled = false;
    stopBackendPolling();
    killServer();
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

/* ------------------------------------------------------------------ */
/*  Python server management                                           */
/* ------------------------------------------------------------------ */

async function startServer(
  context: vscode.ExtensionContext,
  port: number
): Promise<void> {
  killServer();

  const serverPath = path.join(context.extensionPath, 'server', 'main.py');
  serverProcess = cp.spawn('python3', [serverPath], {
    cwd: path.dirname(serverPath),
    env: {
      ...process.env,
      CODE_SERGEANT_PORT: String(port),
      PYTHONUNBUFFERED: '1',
    },
    stdio: 'pipe',
  });

  serverProcess.stdout?.on('data', (data: Buffer) => {
    console.log(`[Code Sergeant server] ${data.toString().trimEnd()}`);
  });

  serverProcess.stderr?.on('data', (data: Buffer) => {
    console.error(`[Code Sergeant server] ${data.toString().trimEnd()}`);
  });

  serverProcess.on('error', (err: Error) => {
    console.error('[Code Sergeant server] process error:', err);
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
    persistedPanelState
  );

  currentPanel.webview.onDidReceiveMessage(
    (message: WebviewMessage) => void handleWebviewMessage(message, context)
  );

  currentPanel.onDidDispose(() => {
    currentPanel = null;
    if (panelLockEnabled && lastServerUrl) {
      setTimeout(() => createOrRevealLockedPanel(context), 50);
      return;
    }
    stopBackendPolling();
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
  // --- SAVE_STATE ---
  if (message.type === 'SAVE_STATE') {
    const state = parsePersistedPanelState(message.payload);
    if (state) {
      persistedPanelState = state;
      void context.workspaceState.update(PANEL_STATE_KEY, state);
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
    } catch {
      currentPanel?.webview.postMessage({
        type: 'RESULT_FAIL',
        message: 'Failed to submit code to backend.',
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
  initialState: PersistedPanelState | null
): string {
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'media', 'webview.js')
  );
  const nonce = getNonce();
  const serializedInitialState = JSON.stringify(initialState ?? null).replace(
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
      script-src 'nonce-${nonce}';
      style-src 'unsafe-inline';
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
  </script>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
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
/*  Backend real-time stream (HTTP polling — no WebSocket dependency)   */
/* ------------------------------------------------------------------ */

/**
 * Polls the backend `/ws` endpoint via plain HTTP to get state updates.
 * Node.js in VS Code does not expose a global WebSocket, so we use
 * polling as a portable alternative.
 */
function startBackendPolling(serverUrl: string): void {
  stopBackendPolling();

  const pollUrl = `${serverUrl}/health`;
  const pollIntervalMs = 3000;

  backendPollTimer = setInterval(async () => {
    try {
      const resp = await fetch(pollUrl);
      if (!resp.ok) {
        return;
      }
      const payload = (await resp.json()) as Record<string, unknown>;

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
      // Ignore transient network errors; the server may still be starting
    }
  }, pollIntervalMs);
}

function stopBackendPolling(): void {
  if (backendPollTimer !== null) {
    clearInterval(backendPollTimer);
    backendPollTimer = null;
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
  if (currentPanel) {
    currentPanel.dispose();
    currentPanel = null;
  }
  stopBackendPolling();
  killServer();
}
