"use strict";
/**
 * Integration tests for the VS Code message bridge module.
 *
 * Verifies message dispatching, listener setup/cleanup,
 * and all message type mappings between extension host and React.
 *
 * Uses a minimal mock of the VS Code API and DOM events.
 */
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
const assert = __importStar(require("assert"));
function createMockVSCodeApi() {
    const api = {
        messages: [],
        stateStore: undefined,
        postMessage(msg) {
            api.messages = [...api.messages, msg];
        },
        getState() {
            return api.stateStore;
        },
        setState(s) {
            api.stateStore = s;
        },
    };
    return api;
}
// ── Override global for bridge ────────────────────────────────────
let mockApi;
function setupBridgeEnvironment() {
    mockApi = createMockVSCodeApi();
    // The bridge lazily calls acquireVsCodeApi — we mock it globally
    globalThis.window = globalThis.window || {};
    globalThis.window.acquireVsCodeApi = () => mockApi;
    // Reset cached api in bridge module (if previously acquired)
    // We do this by re-requiring the module or resetting the closure.
}
// ── Import bridge functions (after global setup) ──────────────────
// We need to dynamically require so the mock is in place
function requireBridge() {
    // Clear module cache to reset the vscodeApi closure
    const bridgePath = require.resolve('../frontend/bridge');
    delete require.cache[bridgePath];
    return require('../frontend/bridge');
}
suite('Bridge — postMessageToExtension', () => {
    setup(() => {
        setupBridgeEnvironment();
    });
    test('submitCode sends SUBMIT_CODE message', () => {
        const bridge = requireBridge();
        bridge.submitCode('print("hello")');
        assert.strictEqual(mockApi.messages.length, 1);
        const msg = mockApi.messages[0];
        assert.strictEqual(msg.type, 'SUBMIT_CODE');
        assert.strictEqual(msg.payload.code, 'print("hello")');
    });
    test('notifyReady sends WEBVIEW_READY message', () => {
        const bridge = requireBridge();
        bridge.notifyReady();
        assert.strictEqual(mockApi.messages.length, 1);
        const msg = mockApi.messages[0];
        assert.strictEqual(msg.type, 'WEBVIEW_READY');
    });
    test('triggerTimeout sends MISSION_TIMEOUT message', () => {
        const bridge = requireBridge();
        bridge.triggerTimeout();
        assert.strictEqual(mockApi.messages.length, 1);
        const msg = mockApi.messages[0];
        assert.strictEqual(msg.type, 'MISSION_TIMEOUT');
    });
    test('callSergeant sends CALL_SERGEANT message with context', () => {
        const bridge = requireBridge();
        bridge.callSergeant('+11234567890', {
            bugType: 'null pointer',
            failCount: 3,
            lastError: 'TypeError',
        });
        assert.strictEqual(mockApi.messages.length, 1);
        const msg = mockApi.messages[0];
        assert.strictEqual(msg.type, 'CALL_SERGEANT');
        assert.strictEqual(msg.payload.phoneNumber, '+11234567890');
        assert.strictEqual(msg.payload.context.bugType, 'null pointer');
    });
    test('multiple messages are sent in order', () => {
        const bridge = requireBridge();
        bridge.notifyReady();
        bridge.submitCode('code1');
        bridge.submitCode('code2');
        bridge.triggerTimeout();
        assert.strictEqual(mockApi.messages.length, 4);
        assert.strictEqual(mockApi.messages[0].type, 'WEBVIEW_READY');
        assert.strictEqual(mockApi.messages[1].type, 'SUBMIT_CODE');
        assert.strictEqual(mockApi.messages[2].type, 'SUBMIT_CODE');
        assert.strictEqual(mockApi.messages[3].type, 'MISSION_TIMEOUT');
    });
});
suite('Bridge — getVSCodeApi', () => {
    setup(() => {
        setupBridgeEnvironment();
    });
    test('returns the VS Code API object', () => {
        const bridge = requireBridge();
        const api = bridge.getVSCodeApi();
        assert.ok(api);
        assert.strictEqual(typeof api.postMessage, 'function');
        assert.strictEqual(typeof api.getState, 'function');
        assert.strictEqual(typeof api.setState, 'function');
    });
    test('returns same object on subsequent calls (cached)', () => {
        const bridge = requireBridge();
        const api1 = bridge.getVSCodeApi();
        const api2 = bridge.getVSCodeApi();
        assert.strictEqual(api1, api2);
    });
    test('returns null when acquireVsCodeApi is not available', () => {
        delete globalThis.window.acquireVsCodeApi;
        const bridgePath = require.resolve('../frontend/bridge');
        delete require.cache[bridgePath];
        const bridge = require('../frontend/bridge');
        const api = bridge.getVSCodeApi();
        assert.strictEqual(api, null);
    });
});
suite('Bridge — createMessageListener', () => {
    let listeners;
    setup(() => {
        setupBridgeEnvironment();
        listeners = [];
        // Mock window.addEventListener / removeEventListener
        globalThis.window.addEventListener = (type, handler) => {
            if (type === 'message') {
                listeners.push(handler);
            }
        };
        globalThis.window.removeEventListener = (type, handler) => {
            if (type === 'message') {
                listeners = listeners.filter((h) => h !== handler);
            }
        };
    });
    function dispatchMessage(data) {
        const event = { data };
        for (const listener of listeners) {
            listener(event);
        }
    }
    test('ANALYZE_START message dispatches ANALYZE_START action', () => {
        const bridge = requireBridge();
        const actions = [];
        const dispatch = (a) => { actions.push(a); };
        const cleanup = bridge.createMessageListener(dispatch);
        dispatchMessage({ type: 'ANALYZE_START' });
        assert.strictEqual(actions.length, 1);
        assert.strictEqual(actions[0].type, 'ANALYZE_START');
        cleanup();
    });
    test('RESULT_FAIL message dispatches RESULT_FAIL action with fields', () => {
        const bridge = requireBridge();
        const actions = [];
        const dispatch = (a) => { actions.push(a); };
        bridge.createMessageListener(dispatch);
        dispatchMessage({
            type: 'RESULT_FAIL',
            message: 'NullPointer',
            punishment: 'DROP 20',
            punishmentPhrase: 'I WILL BE BETTER',
            punishmentReps: 5,
        });
        assert.strictEqual(actions.length, 1);
        const action = actions[0];
        assert.strictEqual(action.type, 'RESULT_FAIL');
        assert.strictEqual(action.message, 'NullPointer');
        assert.strictEqual(action.punishment, 'DROP 20');
        assert.strictEqual(action.punishmentPhrase, 'I WILL BE BETTER');
        assert.strictEqual(action.punishmentReps, 5);
    });
    test('RESULT_PASS message dispatches RESULT_PASS action', () => {
        const bridge = requireBridge();
        const actions = [];
        const dispatch = (a) => { actions.push(a); };
        bridge.createMessageListener(dispatch);
        dispatchMessage({ type: 'RESULT_PASS', message: 'Great!' });
        assert.strictEqual(actions.length, 1);
        assert.strictEqual(actions[0].type, 'RESULT_PASS');
        assert.strictEqual(actions[0].message, 'Great!');
    });
    test('CHALLENGE_LOADED message dispatches CHALLENGE_LOADED action', () => {
        const bridge = requireBridge();
        const actions = [];
        const dispatch = (a) => { actions.push(a); };
        bridge.createMessageListener(dispatch);
        dispatchMessage({
            type: 'CHALLENGE_LOADED',
            challenge: { language: 'python', code: 'x = 1', instructions: 'Fix it' },
        });
        assert.strictEqual(actions.length, 1);
        const action = actions[0];
        assert.strictEqual(action.type, 'CHALLENGE_LOADED');
        assert.strictEqual(action.code, 'x = 1');
        assert.strictEqual(action.language, 'python');
        assert.strictEqual(action.instructions, 'Fix it');
    });
    test('CALL_REQUESTED message dispatches CALL_REQUESTED action', () => {
        const bridge = requireBridge();
        const actions = [];
        const dispatch = (a) => { actions.push(a); };
        bridge.createMessageListener(dispatch);
        dispatchMessage({ type: 'CALL_REQUESTED' });
        assert.strictEqual(actions.length, 1);
        assert.strictEqual(actions[0].type, 'CALL_REQUESTED');
    });
    test('CALL_INITIATED message dispatches with callId', () => {
        const bridge = requireBridge();
        const actions = [];
        const dispatch = (a) => { actions.push(a); };
        bridge.createMessageListener(dispatch);
        dispatchMessage({ type: 'CALL_INITIATED', callId: 'abc-123' });
        assert.strictEqual(actions.length, 1);
        assert.strictEqual(actions[0].type, 'CALL_INITIATED');
        assert.strictEqual(actions[0].callId, 'abc-123');
    });
    test('CALL_IN_PROGRESS message dispatches correctly', () => {
        const bridge = requireBridge();
        const actions = [];
        const dispatch = (a) => { actions.push(a); };
        bridge.createMessageListener(dispatch);
        dispatchMessage({ type: 'CALL_IN_PROGRESS' });
        assert.strictEqual(actions.length, 1);
        assert.strictEqual(actions[0].type, 'CALL_IN_PROGRESS');
    });
    test('CALL_ENDED message dispatches correctly', () => {
        const bridge = requireBridge();
        const actions = [];
        const dispatch = (a) => { actions.push(a); };
        bridge.createMessageListener(dispatch);
        dispatchMessage({ type: 'CALL_ENDED' });
        assert.strictEqual(actions.length, 1);
        assert.strictEqual(actions[0].type, 'CALL_ENDED');
    });
    test('CALL_ERROR message dispatches with error message', () => {
        const bridge = requireBridge();
        const actions = [];
        const dispatch = (a) => { actions.push(a); };
        bridge.createMessageListener(dispatch);
        dispatchMessage({ type: 'CALL_ERROR', message: 'Twilio failed' });
        assert.strictEqual(actions.length, 1);
        assert.strictEqual(actions[0].type, 'CALL_ERROR');
        assert.strictEqual(actions[0].message, 'Twilio failed');
    });
    test('unknown message type is ignored', () => {
        const bridge = requireBridge();
        const actions = [];
        const dispatch = (a) => { actions.push(a); };
        bridge.createMessageListener(dispatch);
        dispatchMessage({ type: 'UNKNOWN_MESSAGE' });
        assert.strictEqual(actions.length, 0);
    });
    test('null/undefined message data is ignored', () => {
        const bridge = requireBridge();
        const actions = [];
        const dispatch = (a) => { actions.push(a); };
        bridge.createMessageListener(dispatch);
        const event = { data: null };
        for (const listener of listeners) {
            listener(event);
        }
        assert.strictEqual(actions.length, 0);
    });
    test('message without type field is ignored', () => {
        const bridge = requireBridge();
        const actions = [];
        const dispatch = (a) => { actions.push(a); };
        bridge.createMessageListener(dispatch);
        const event = { data: { foo: 'bar' } };
        for (const listener of listeners) {
            listener(event);
        }
        assert.strictEqual(actions.length, 0);
    });
    test('cleanup removes listener', () => {
        const bridge = requireBridge();
        const actions = [];
        const dispatch = (a) => { actions.push(a); };
        const cleanup = bridge.createMessageListener(dispatch);
        assert.strictEqual(listeners.length, 1);
        cleanup();
        assert.strictEqual(listeners.length, 0);
        // Messages after cleanup should not dispatch
        dispatchMessage({ type: 'ANALYZE_START' });
        assert.strictEqual(actions.length, 0);
    });
    test('multiple listeners can coexist', () => {
        const bridge = requireBridge();
        const actions1 = [];
        const actions2 = [];
        const cleanup1 = bridge.createMessageListener((a) => { actions1.push(a); });
        const cleanup2 = bridge.createMessageListener((a) => { actions2.push(a); });
        dispatchMessage({ type: 'ANALYZE_START' });
        assert.strictEqual(actions1.length, 1);
        assert.strictEqual(actions2.length, 1);
        cleanup1();
        cleanup2();
    });
    test('full message sequence: ANALYZE_START → RESULT_FAIL → RESULT_PASS', () => {
        const bridge = requireBridge();
        const actions = [];
        const dispatch = (a) => { actions.push(a); };
        bridge.createMessageListener(dispatch);
        dispatchMessage({ type: 'ANALYZE_START' });
        dispatchMessage({ type: 'RESULT_FAIL', message: 'Bug found' });
        dispatchMessage({ type: 'RESULT_PASS', message: 'Fixed!' });
        assert.strictEqual(actions.length, 3);
        assert.strictEqual(actions[0].type, 'ANALYZE_START');
        assert.strictEqual(actions[1].type, 'RESULT_FAIL');
        assert.strictEqual(actions[2].type, 'RESULT_PASS');
    });
});
//# sourceMappingURL=bridge.test.js.map