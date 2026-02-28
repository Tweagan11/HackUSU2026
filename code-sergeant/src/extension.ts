import * as vscode from 'vscode';

const API_BASE = 'localhost:8000'; // 🔧 change this

interface Challenge {
  code: string;
  file: string;
  line: number;
  countdownSeconds: number;
}

interface CheckResult {
  solved: boolean;
}

interface PunishmentResult {
  punishment: string;
}

export function activate(context: vscode.ExtensionContext) {

  const disposable = vscode.commands.registerCommand('code-sergeant.drill', async () => {

    const res = await fetch(`${API_BASE}/challenge`);
    const challenge = await res.json() as Challenge;

    const panel = vscode.window.createWebviewPanel(
      'codeSargeant',
      '🪖 CODE SERGEANT',
      vscode.ViewColumn.One,
      { enableScripts: true }
    );

    panel.webview.html = getWebviewHTML(challenge.code, challenge.countdownSeconds);

    const pollInterval = setInterval(async () => {
      const checkRes = await fetch(`${API_BASE}/check`);
      const { solved } = await checkRes.json() as CheckResult;

      if (solved) {
        clearInterval(pollInterval);
        panel.dispose();

        const fileUri = vscode.Uri.file(challenge.file);
        const doc = await vscode.workspace.openTextDocument(fileUri);
        const editor = await vscode.window.showTextDocument(doc);
        const position = new vscode.Position(challenge.line - 1, 0);
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(new vscode.Range(position, position));
      }
    }, 2000);

    panel.webview.onDidReceiveMessage(async message => {
      if (message.command === 'countdownExpired') {
        clearInterval(pollInterval);

        const punishRes = await fetch(`${API_BASE}/punishment`);
        const { punishment } = await punishRes.json() as PunishmentResult;

        panel.webview.postMessage({ command: 'punish', text: punishment });
      }
    });

    panel.onDidDispose(() => clearInterval(pollInterval));
  });

  context.subscriptions.push(disposable);
}

function getWebviewHTML(code: string, seconds: number): string {
  return `<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      background: #1a0000;
      color: #ff4444;
      font-family: 'Courier New', monospace;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 30px;
    }
    h1 { font-size: 2.5em; color: #ff0000; text-shadow: 0 0 10px red; }
    #sergeant { font-size: 5em; }
    #countdown {
      font-size: 3em;
      color: #ff6600;
      margin: 20px;
      font-weight: bold;
    }
    pre {
      background: #0d0d0d;
      border: 2px solid #ff0000;
      padding: 20px;
      width: 80%;
      overflow-x: auto;
      font-size: 1em;
      color: #ff9999;
    }
    #punishment {
      display: none;
      font-size: 1.5em;
      color: #ff0000;
      margin-top: 20px;
      text-align: center;
      animation: flash 0.5s infinite;
    }
    @keyframes flash {
      0%, 100% { opacity: 1; }
      50% { opacity: 0; }
    }
  </style>
</head>
<body>
  <div id="sergeant">🪖</div>
  <h1>FIX THE BUG, SOLDIER!</h1>
  <div id="countdown">${seconds}</div>
  <pre><code>${escapeHtml(code)}</code></pre>
  <div id="punishment"></div>

  <script>
    const vscode = acquireVsCodeApi();
    let timeLeft = ${seconds};

    const timer = setInterval(() => {
      timeLeft--;
      document.getElementById('countdown').textContent = timeLeft;

      if (timeLeft <= 0) {
        clearInterval(timer);
        vscode.postMessage({ command: 'countdownExpired' });
      }
    }, 1000);

    window.addEventListener('message', event => {
      const msg = event.data;
      if (msg.command === 'punish') {
        document.getElementById('sergeant').textContent = '😤';
        document.getElementById('punishment').style.display = 'block';
        document.getElementById('punishment').textContent = msg.text;
      }
    });
  </script>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function deactivate() {}