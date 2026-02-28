"use strict";
/* =========================================
 * Sergeant Debugger — VS Code Message Bridge
 * =========================================
 * Handles communication between the React webview
 * and the VS Code extension host.
 *
 * In production: messages flow via vscode.postMessage / window.addEventListener
 * In dev mode:   acquireVsCodeApi is undefined, mock is used instead
 * ========================================= */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVSCodeApi = getVSCodeApi;
exports.postMessageToExtension = postMessageToExtension;
exports.submitCode = submitCode;
exports.triggerTimeout = triggerTimeout;
exports.callSergeant = callSergeant;
exports.createMessageListener = createMessageListener;
let vscodeApi = null;
/** Lazily acquire the VS Code API (only available in webview context) */
function getVSCodeApi() {
    if (!vscodeApi && typeof window.acquireVsCodeApi === 'function') {
        vscodeApi = window.acquireVsCodeApi();
    }
    return vscodeApi;
}
/** Send a message to the VS Code extension host */
function postMessageToExtension(type, payload) {
    const api = getVSCodeApi();
    if (api) {
        api.postMessage({ type, payload });
    }
}
/** Send code to the extension for analysis */
function submitCode(code) {
    postMessageToExtension('SUBMIT_CODE', { code });
}
/** Trigger the mission timeout on the backend */
function triggerTimeout() {
    postMessageToExtension('MISSION_TIMEOUT');
}
/**
 * Request the sergeant to call the user's phone via Twilio + ElevenLabs.
 * The extension forwards this to the backend POST /call/initiate.
 */
function callSergeant(phoneNumber, context) {
    postMessageToExtension('CALL_SERGEANT', { phoneNumber, context });
}
/**
 * Listen for messages from the VS Code extension host.
 * Maps incoming messages to reducer actions.
 * Returns a cleanup function to remove the listener.
 *
 * MESSAGE CONTRACT (from extension):
 *   { type: 'ANALYZE_START' }
 *   { type: 'RESULT_FAIL', message: string }
 *   { type: 'RESULT_PASS', message: string }
 *   { type: 'CALL_INITIATED', callId: string }
 *   { type: 'CALL_IN_PROGRESS' }
 *   { type: 'CALL_ENDED' }
 *   { type: 'CALL_ERROR', message: string }
 */
function createMessageListener(dispatch) {
    const handler = (event) => {
        const message = event.data;
        if (!message || !message.type)
            return;
        switch (message.type) {
            case 'ANALYZE_START':
                dispatch({ type: 'ANALYZE_START' });
                break;
            case 'RESULT_FAIL':
                dispatch({ type: 'RESULT_FAIL', message: message.message, punishment: ('punishment' in message ? message.punishment : undefined) });
                break;
            case 'RESULT_PASS':
                dispatch({ type: 'RESULT_PASS', message: message.message });
                break;
            case 'CALL_INITIATED':
                dispatch({ type: 'CALL_INITIATED', callId: message.callId });
                break;
            case 'CALL_IN_PROGRESS':
                dispatch({ type: 'CALL_IN_PROGRESS' });
                break;
            case 'CALL_ENDED':
                dispatch({ type: 'CALL_ENDED' });
                break;
            case 'CALL_ERROR':
                dispatch({ type: 'CALL_ERROR', message: message.message });
                break;
        }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
}
//# sourceMappingURL=bridge.js.map