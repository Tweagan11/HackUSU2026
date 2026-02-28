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
const fs = __importStar(require("fs"));
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
let lastChallenge = null;
let challengeSendCount = 0;
const MAX_CHALLENGE_SENDS = 5;
let workflowInFlight = false;
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
    const terminalOpenListener = vscode.window.onDidOpenTerminal((terminal) => {
        triggerSergeantIfNeeded(context, `terminal-open:${terminal.name}`);
    });
    const activeTerminalListener = vscode.window.onDidChangeActiveTerminal((terminal) => {
        if (!terminal) {
            return;
        }
        triggerSergeantIfNeeded(context, `terminal-focus:${terminal.name}`);
    });
    const debugSessionListener = vscode.debug.onDidStartDebugSession(() => {
        triggerSergeantIfNeeded(context, 'debug');
    });
    const taskStartListener = vscode.tasks.onDidStartTask((event) => {
        triggerSergeantIfNeeded(context, `task:${event.execution.task.name}`);
    });
    const taskProcessStartListener = vscode.tasks.onDidStartTaskProcess((event) => {
        triggerSergeantIfNeeded(context, `task-process:${event.execution.task.name}`);
    });
    context.subscriptions.push(disposable, terminalExecutionListener, terminalOpenListener, activeTerminalListener, debugSessionListener, taskStartListener, taskProcessStartListener);
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
            throw new Error(`Server returned ${startResponse.status} ${startResponse.statusText}`);
        }
        const startPayload = (await startResponse.json());
        if (!startPayload ||
            typeof startPayload !== 'object' ||
            !startPayload.state ||
            typeof startPayload.state !== 'object') {
            throw new Error('Server returned an invalid start payload');
        }
        // Challenge will arrive asynchronously via /state polling — clear any stale one
        lastChallenge = null;
        challengeSendCount = 0;
        console.log('[Code Sergeant] Agent running in background, challenge will arrive via polling');
        // Fresh run should start from boot/training flow, not prior mission state.
        lastServerUrl = serverUrl;
        startBackendPolling(serverUrl);
    }
    catch (error) {
        panelLockEnabled = false;
        if (panelInitializedThisRun && currentPanel) {
            currentPanel.dispose();
        }
        workflowInFlight = false;
        stopBackendPolling();
        killServer();
        lastServerUrl = null;
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
function resolveActiveWorkingDirectory() {
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
function pathFromUri(uri) {
    return uri.scheme === 'file' ? uri.fsPath : uri.path;
}
function resolveActiveEditorLanguageId() {
    const rawLanguageId = vscode.window.activeTextEditor?.document.languageId;
    if (!rawLanguageId) {
        return 'plaintext';
    }
    const mapping = {
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
function findPython3() {
    for (const candidate of ['python3', 'python']) {
        try {
            const result = cp.execFileSync(candidate, ['--version'], {
                encoding: 'utf-8',
                timeout: 5000,
            });
            if (result.startsWith('Python 3')) {
                return candidate;
            }
        }
        catch {
            // not found — try next
        }
    }
    throw new Error('Could not find Python 3. Please install Python 3.10+ and make sure it is on your PATH.');
}
/** Run a shell command and return its stdout. Rejects on non-zero exit. */
function execAsync(cmd, args, cwd) {
    return new Promise((resolve, reject) => {
        cp.execFile(cmd, args, { cwd, timeout: 300_000 }, (err, stdout, stderr) => {
            if (err) {
                reject(new Error(`${cmd} ${args.join(' ')} failed:\n${stderr || err.message}`));
            }
            else {
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
async function ensureVenv(serverDir, progress) {
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
    }
    catch {
        // stamp doesn't exist yet
    }
    if (currentStamp !== existingStamp) {
        progress.report({ message: 'Installing Python dependencies…' });
        await execAsync(venvPython, ['-m', 'pip', 'install', '--upgrade', '-q', '-r', requirementsPath], serverDir);
        fs.writeFileSync(stampFile, currentStamp, 'utf-8');
        console.log('[Code Sergeant] Installed requirements into venv');
    }
    else {
        console.log('[Code Sergeant] Requirements already up-to-date');
    }
    return venvPython;
}
async function startServer(context, port) {
    killServer();
    const serverDir = path.join(context.extensionPath, 'server');
    const serverPath = path.join(serverDir, 'main.py');
    // Bootstrap the venv with a visible progress indicator
    const venvPython = await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Code Sergeant',
        cancellable: false,
    }, (progress) => ensureVenv(serverDir, progress));
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
    currentPanel.webview.html = getWebviewHtml(currentPanel.webview, context.extensionUri, persistedPanelState, resolveActiveEditorLanguageId());
    currentPanel.webview.onDidReceiveMessage((message) => void handleWebviewMessage(message, context));
    currentPanel.onDidDispose(() => {
        currentPanel = null;
        if (panelLockEnabled) {
            setTimeout(() => createOrRevealLockedPanel(context), 50);
            return;
        }
        workflowInFlight = false;
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
        }
        else {
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
            const code = message.payload?.code ?? '';
            const resp = await fetch(`${serverUrl}/submit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, response: code }),
            });
            if (!resp.ok) {
                throw new Error(`Submit failed: ${resp.status} ${resp.statusText}`);
            }
            const payload = (await resp.json());
            if (payload.is_correct) {
                currentPanel?.webview.postMessage({
                    type: 'RESULT_PASS',
                    message: payload.feedback ?? 'Mission complete. Outstanding work, soldier.',
                });
            }
            else {
                currentPanel?.webview.postMessage({
                    type: 'RESULT_FAIL',
                    message: payload.feedback ?? 'Incorrect. Try again, recruit.',
                });
            }
        }
        catch (err) {
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
function getWebviewHtml(webview, extensionUri, initialState, editorLanguage) {
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'webview.js'));
    const nonce = getNonce();
    const serializedInitialState = JSON.stringify(initialState ?? null).replace(/</g, '\\u003c');
    const serializedEditorLanguage = JSON.stringify(editorLanguage ?? 'plaintext').replace(/</g, '\\u003c');
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
    window.__CODE_SERGEANT_EDITOR_LANGUAGE__ = ${serializedEditorLanguage};
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
 * Polls the backend `/state` endpoint via plain HTTP to get state updates.
 * When the challenge becomes available (agent finished in background),
 * sends CHALLENGE_LOADED to the webview.
 */
function startBackendPolling(serverUrl) {
    stopBackendPolling();
    const pollUrl = `${serverUrl}/state`;
    const pollIntervalMs = 2000;
    backendPollTimer = setInterval(async () => {
        try {
            const resp = await fetch(pollUrl);
            if (!resp.ok) {
                return;
            }
            const payload = (await resp.json());
            // Detect challenge arriving from the background agent run.
            // Re-send up to MAX_CHALLENGE_SENDS times to handle cases where
            // the webview's message listener wasn't ready on the first delivery.
            if (payload.challenge) {
                const challenge = payload.challenge;
                if (!lastChallenge) {
                    lastChallenge = challenge;
                    challengeSendCount = 0;
                    console.log('[Code Sergeant] Challenge arrived via polling:', JSON.stringify(challenge));
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
    lastServerUrl = null;
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
    workflowInFlight = false;
    if (currentPanel) {
        currentPanel.dispose();
        currentPanel = null;
    }
    stopBackendPolling();
    killServer();
}
//# sourceMappingURL=extension.js.map