"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const cp = __importStar(require("child_process"));
const path = __importStar(require("path"));
const net = __importStar(require("net"));
/* ------------------------------------------------------------------ */
/*  Module-level state                                                 */
/* ------------------------------------------------------------------ */
let serverProcess = null;
let currentPanel = null;
let panelLockEnabled = false;
let lastServerUrl = null;
let lastAutoTriggerAt = 0;
let backendPollTimer = null;
let persistedPanelState = null;
const AUTO_TRIGGER_DEBOUNCE_MS = 1500;
const PANEL_STATE_KEY = 'codeSergeant.panelState';
/* eslint-enable @typescript-eslint/no-explicit-any */
/* ------------------------------------------------------------------ */
/*  Activation                                                         */
/* ------------------------------------------------------------------ */
function activate(context) {
    persistedPanelState = parsePersistedPanelState(context.workspaceState.get(PANEL_STATE_KEY));
    const disposable = vscode.commands.registerCommand('code-sergeant.drill', async () => {
        await openSergeantWorkflow(context, 'manual');
    });
    const terminalExecutionListener = vscode.window.onDidStartTerminalShellExecution((event) => {
        const commandLine = event.execution.commandLine.value;
        if (!shouldAutoTriggerForCommand(commandLine)) {
            return;
        }
        triggerSergeantIfNeeded(context, `terminal:${commandLine}`);
    });
    const debugSessionListener = vscode.debug.onDidStartDebugSession(() => {
        triggerSergeantIfNeeded(context, 'debug');
    });
    context.subscriptions.push(disposable, terminalExecutionListener, debugSessionListener);
}
/* ------------------------------------------------------------------ */
/*  Workflow entry-point                                               */
/* ------------------------------------------------------------------ */
function triggerSergeantIfNeeded(context, reason) {
    const now = Date.now();
    if (now - lastAutoTriggerAt < AUTO_TRIGGER_DEBOUNCE_MS) {
        return;
    }
    lastAutoTriggerAt = now;
    void openSergeantWorkflow(context, reason);
}
async function openSergeantWorkflow(context, reason) {
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
        const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
        const workspacePayload = {
            files: workspaceFolders.map((f) => f.uri.fsPath),
        };
        const startResponse = await fetch(`${serverUrl}/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(workspacePayload),
        });
        if (!startResponse.ok) {
            throw new Error(`Server returned ${startResponse.status} ${startResponse.statusText}`);
        }
        const startPayload = (await startResponse.json());
        if (!startPayload ||
            typeof startPayload !== 'object' ||
            !startPayload.state ||
            typeof startPayload.state !== 'object') {
            throw new Error('Server returned an invalid start payload');
        }
        await clearPersistedPanelState(context);
        panelLockEnabled = true;
        lastServerUrl = serverUrl;
        createOrRevealLockedPanel(context);
        startBackendPolling(serverUrl);
    }
    catch (error) {
        panelLockEnabled = false;
        stopBackendPolling();
        killServer();
        const msg = error instanceof Error ? error.message : String(error);
        void vscode.window.showErrorMessage(`Code Sergeant failed to start: ${msg}`);
    }
}
async function clearPersistedPanelState(context) {
    persistedPanelState = null;
    await context.workspaceState.update(PANEL_STATE_KEY, undefined);
}
/* ------------------------------------------------------------------ */
/*  Auto-trigger helpers                                               */
/* ------------------------------------------------------------------ */
function shouldAutoTriggerForCommand(rawCommandLine) {
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
function stripLeadingEnvAssignments(commandLine) {
    let remaining = commandLine.trimStart();
    const envAssignment = /^[a-z_][a-z0-9_]*=(?:"[^"]*"|'[^']*'|[^\s]+)\s*/i;
    while (envAssignment.test(remaining)) {
        const match = remaining.match(envAssignment);
        if (!match) {
            break;
        }
        remaining = remaining.slice(match[0].length).trimStart();
    }
    return remaining;
}
/* ------------------------------------------------------------------ */
/*  Python server management                                           */
/* ------------------------------------------------------------------ */
async function startServer(context, port) {
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
    serverProcess.stdout?.on('data', (data) => {
        console.log(`[Code Sergeant server] ${data.toString().trimEnd()}`);
    });
    serverProcess.stderr?.on('data', (data) => {
        console.error(`[Code Sergeant server] ${data.toString().trimEnd()}`);
    });
    serverProcess.on('error', (err) => {
        console.error('[Code Sergeant server] process error:', err);
    });
}
async function findAvailablePort() {
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
function createOrRevealLockedPanel(context) {
    if (currentPanel) {
        currentPanel.reveal(vscode.ViewColumn.Active);
        return;
    }
    currentPanel = vscode.window.createWebviewPanel('codeSergeant', 'Code Sergeant', vscode.ViewColumn.Active, {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
            vscode.Uri.joinPath(context.extensionUri, 'media'),
        ],
    });
    currentPanel.webview.html = getWebviewHtml(currentPanel.webview, context.extensionUri, persistedPanelState);
    currentPanel.webview.onDidReceiveMessage((message) => void handleWebviewMessage(message, context));
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
async function handleWebviewMessage(message, context) {
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
            const code = message.payload?.code ?? '';
            const resp = await fetch(`${serverUrl}/submit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, response: code }),
            });
            if (!resp.ok) {
                throw new Error(`Submit failed: ${resp.status} ${resp.statusText}`);
            }
        }
        catch {
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
            const payload = (await resp.json());
            currentPanel?.webview.postMessage({
                type: 'RESULT_FAIL',
                message: payload.message ?? 'Time expired.',
                punishment: payload.punishment,
            });
        }
        catch {
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
        const phoneNumber = message.payload?.phoneNumber ?? '';
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
            const payload = (await resp.json());
            if (payload.ok && payload.call_id) {
                currentPanel?.webview.postMessage({
                    type: 'CALL_INITIATED',
                    callId: payload.call_id,
                });
                pollCallStatus(payload.call_id);
            }
            else {
                currentPanel?.webview.postMessage({
                    type: 'CALL_ERROR',
                    message: payload.error ?? 'Failed to initiate call.',
                });
            }
        }
        catch (err) {
            currentPanel?.webview.postMessage({
                type: 'CALL_ERROR',
                message: err instanceof Error
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
        }
        catch {
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
function getWebviewHtml(webview, extensionUri, initialState) {
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'webview.js'));
    const nonce = getNonce();
    const serializedInitialState = JSON.stringify(initialState ?? null).replace(/</g, '\\u003c');
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
function parsePersistedPanelState(value) {
    if (!value || typeof value !== 'object') {
        return null;
    }
    const candidate = value;
    if (candidate.version !== 1) {
        return null;
    }
    if (typeof candidate.appState !== 'object' ||
        candidate.appState === null) {
        return null;
    }
    if (typeof candidate.timeLeftSec !== 'number' ||
        !Number.isFinite(candidate.timeLeftSec)) {
        return null;
    }
    if (typeof candidate.savedAt !== 'number' ||
        !Number.isFinite(candidate.savedAt)) {
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
function startBackendPolling(serverUrl) {
    stopBackendPolling();
    const pollUrl = `${serverUrl}/health`;
    const pollIntervalMs = 3000;
    backendPollTimer = setInterval(async () => {
        try {
            const resp = await fetch(pollUrl);
            if (!resp.ok) {
                return;
            }
            const payload = (await resp.json());
            // If the backend signals completion, relay to the front-end
            if (payload.isComplete === true) {
                currentPanel?.webview.postMessage({
                    type: 'RESULT_PASS',
                    message: (typeof payload.message === 'string' && payload.message) ||
                        'Analysis complete.',
                });
            }
            // Also relay as legacy update
            currentPanel?.webview.postMessage({ type: 'update', payload });
        }
        catch {
            // Ignore transient network errors; the server may still be starting
        }
    }, pollIntervalMs);
}
function stopBackendPolling() {
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
function pollCallStatus(callId) {
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
            const data = (await resp.json());
            if (!data.ok) {
                clearInterval(interval);
                return;
            }
            if (data.status === 'in-progress' ||
                data.status === 'in_progress') {
                currentPanel?.webview.postMessage({ type: 'CALL_IN_PROGRESS' });
            }
            else if (data.status === 'ended') {
                currentPanel?.webview.postMessage({ type: 'CALL_ENDED' });
                clearInterval(interval);
            }
        }
        catch {
            // Silently continue polling on transient failures
        }
    }, intervalMs);
}
/* ------------------------------------------------------------------ */
/*  Server health-check                                                */
/* ------------------------------------------------------------------ */
async function waitForServer(url, retries = 20, delay = 500) {
    for (let i = 0; i < retries; i++) {
        if (serverProcess && serverProcess.exitCode !== null) {
            throw new Error(`Python server exited early with code ${serverProcess.exitCode}`);
        }
        try {
            const resp = await fetch(url);
            if (resp.ok) {
                return;
            }
        }
        catch {
            // keep retrying
        }
        await new Promise((r) => setTimeout(r, delay));
    }
    throw new Error('Server did not start in time');
}
/* ------------------------------------------------------------------ */
/*  Cleanup helpers                                                    */
/* ------------------------------------------------------------------ */
function killServer() {
    if (serverProcess) {
        if (serverProcess.exitCode === null) {
            serverProcess.kill();
        }
        serverProcess = null;
    }
}
function getNonce() {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let text = '';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
/* ------------------------------------------------------------------ */
/*  Deactivation                                                       */
/* ------------------------------------------------------------------ */
function deactivate() {
    panelLockEnabled = false;
    if (currentPanel) {
        currentPanel.dispose();
        currentPanel = null;
    }
    stopBackendPolling();
    killServer();
}
//# sourceMappingURL=extension.js.map