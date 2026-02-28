/**
 * Integration tests for the VS Code message bridge module.
 *
 * Verifies message dispatching, listener setup/cleanup,
 * and all message type mappings between extension host and React.
 *
 * Uses a minimal mock of the VS Code API and DOM events.
 */

import * as assert from 'assert';
import type { AppAction, ExtensionMessage } from '../frontend/types';

// ── Minimal VS Code API mock ──────────────────────────────────────

interface MockVSCodeApi {
    messages: unknown[];
    stateStore: unknown;
    postMessage: (msg: unknown) => void;
    getState: () => unknown;
    setState: (s: unknown) => void;
}

function createMockVSCodeApi(): MockVSCodeApi {
    const api: MockVSCodeApi = {
        messages: [],
        stateStore: undefined,
        postMessage(msg: unknown) {
            api.messages = [...api.messages, msg];
        },
        getState() {
            return api.stateStore;
        },
        setState(s: unknown) {
            api.stateStore = s;
        },
    };
    return api;
}

// ── Override global for bridge ────────────────────────────────────

let mockApi: MockVSCodeApi;

function setupBridgeEnvironment() {
    mockApi = createMockVSCodeApi();
    // The bridge lazily calls acquireVsCodeApi — we mock it globally
    (globalThis as any).window = (globalThis as any).window || {};
    (globalThis as any).window.acquireVsCodeApi = () => mockApi;
    // Reset cached api in bridge module (if previously acquired)
    // We do this by re-requiring the module or resetting the closure.
}

// ── Import bridge functions (after global setup) ──────────────────

// We need to dynamically require so the mock is in place
function requireBridge() {
    // Clear module cache to reset the vscodeApi closure
    const bridgePath = require.resolve('../frontend/bridge');
    delete require.cache[bridgePath];
    return require('../frontend/bridge') as typeof import('../frontend/bridge');
}

suite('Bridge — postMessageToExtension', () => {
    setup(() => {
        setupBridgeEnvironment();
    });

    test('submitCode sends SUBMIT_CODE message', () => {
        const bridge = requireBridge();
        bridge.submitCode('print("hello")');
        assert.strictEqual(mockApi.messages.length, 1);
        const msg = mockApi.messages[0] as { type: string; payload: { code: string } };
        assert.strictEqual(msg.type, 'SUBMIT_CODE');
        assert.strictEqual(msg.payload.code, 'print("hello")');
    });

    test('notifyReady sends WEBVIEW_READY message', () => {
        const bridge = requireBridge();
        bridge.notifyReady();
        assert.strictEqual(mockApi.messages.length, 1);
        const msg = mockApi.messages[0] as { type: string };
        assert.strictEqual(msg.type, 'WEBVIEW_READY');
    });

    test('triggerTimeout sends MISSION_TIMEOUT message', () => {
        const bridge = requireBridge();
        bridge.triggerTimeout();
        assert.strictEqual(mockApi.messages.length, 1);
        const msg = mockApi.messages[0] as { type: string };
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
        const msg = mockApi.messages[0] as {
            type: string;
            payload: { phoneNumber: string; context: { bugType: string } };
        };
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
        assert.strictEqual((mockApi.messages[0] as any).type, 'WEBVIEW_READY');
        assert.strictEqual((mockApi.messages[1] as any).type, 'SUBMIT_CODE');
        assert.strictEqual((mockApi.messages[2] as any).type, 'SUBMIT_CODE');
        assert.strictEqual((mockApi.messages[3] as any).type, 'MISSION_TIMEOUT');
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
        assert.strictEqual(typeof api!.postMessage, 'function');
        assert.strictEqual(typeof api!.getState, 'function');
        assert.strictEqual(typeof api!.setState, 'function');
    });

    test('returns same object on subsequent calls (cached)', () => {
        const bridge = requireBridge();
        const api1 = bridge.getVSCodeApi();
        const api2 = bridge.getVSCodeApi();
        assert.strictEqual(api1, api2);
    });

    test('returns null when acquireVsCodeApi is not available', () => {
        delete (globalThis as any).window.acquireVsCodeApi;
        const bridgePath = require.resolve('../frontend/bridge');
        delete require.cache[bridgePath];
        const bridge = require('../frontend/bridge');
        const api = bridge.getVSCodeApi();
        assert.strictEqual(api, null);
    });
});

suite('Bridge — createMessageListener', () => {
    let listeners: ((event: MessageEvent) => void)[];

    setup(() => {
        setupBridgeEnvironment();
        listeners = [];
        // Mock window.addEventListener / removeEventListener
        (globalThis as any).window.addEventListener = (type: string, handler: any) => {
            if (type === 'message') {
                listeners.push(handler);
            }
        };
        (globalThis as any).window.removeEventListener = (type: string, handler: any) => {
            if (type === 'message') {
                listeners = listeners.filter((h) => h !== handler);
            }
        };
    });

    function dispatchMessage(data: ExtensionMessage) {
        const event = { data } as MessageEvent<ExtensionMessage>;
        for (const listener of listeners) {
            listener(event);
        }
    }

    test('ANALYZE_START message dispatches ANALYZE_START action', () => {
        const bridge = requireBridge();
        const actions: AppAction[] = [];
        const dispatch = (a: AppAction) => { actions.push(a); };

        const cleanup = bridge.createMessageListener(dispatch);
        dispatchMessage({ type: 'ANALYZE_START' });

        assert.strictEqual(actions.length, 1);
        assert.strictEqual(actions[0].type, 'ANALYZE_START');
        cleanup();
    });

    test('RESULT_FAIL message dispatches RESULT_FAIL action with fields', () => {
        const bridge = requireBridge();
        const actions: AppAction[] = [];
        const dispatch = (a: AppAction) => { actions.push(a); };

        bridge.createMessageListener(dispatch);
        dispatchMessage({
            type: 'RESULT_FAIL',
            message: 'NullPointer',
            punishment: 'DROP 20',
            punishmentPhrase: 'I WILL BE BETTER',
            punishmentReps: 5,
        });

        assert.strictEqual(actions.length, 1);
        const action = actions[0] as Extract<AppAction, { type: 'RESULT_FAIL' }>;
        assert.strictEqual(action.type, 'RESULT_FAIL');
        assert.strictEqual(action.message, 'NullPointer');
        assert.strictEqual(action.punishment, 'DROP 20');
        assert.strictEqual(action.punishmentPhrase, 'I WILL BE BETTER');
        assert.strictEqual(action.punishmentReps, 5);
    });

    test('RESULT_PASS message dispatches RESULT_PASS action', () => {
        const bridge = requireBridge();
        const actions: AppAction[] = [];
        const dispatch = (a: AppAction) => { actions.push(a); };

        bridge.createMessageListener(dispatch);
        dispatchMessage({ type: 'RESULT_PASS', message: 'Great!' });

        assert.strictEqual(actions.length, 1);
        assert.strictEqual(actions[0].type, 'RESULT_PASS');
        assert.strictEqual((actions[0] as any).message, 'Great!');
    });

    test('CHALLENGE_LOADED message dispatches CHALLENGE_LOADED action', () => {
        const bridge = requireBridge();
        const actions: AppAction[] = [];
        const dispatch = (a: AppAction) => { actions.push(a); };

        bridge.createMessageListener(dispatch);
        dispatchMessage({
            type: 'CHALLENGE_LOADED',
            challenge: { language: 'python', code: 'x = 1', instructions: 'Fix it' },
        });

        assert.strictEqual(actions.length, 1);
        const action = actions[0] as Extract<AppAction, { type: 'CHALLENGE_LOADED' }>;
        assert.strictEqual(action.type, 'CHALLENGE_LOADED');
        assert.strictEqual(action.code, 'x = 1');
        assert.strictEqual(action.language, 'python');
        assert.strictEqual(action.instructions, 'Fix it');
    });

    test('CALL_REQUESTED message dispatches CALL_REQUESTED action', () => {
        const bridge = requireBridge();
        const actions: AppAction[] = [];
        const dispatch = (a: AppAction) => { actions.push(a); };

        bridge.createMessageListener(dispatch);
        dispatchMessage({ type: 'CALL_REQUESTED' } as ExtensionMessage);

        assert.strictEqual(actions.length, 1);
        assert.strictEqual(actions[0].type, 'CALL_REQUESTED');
    });

    test('CALL_INITIATED message dispatches with callId', () => {
        const bridge = requireBridge();
        const actions: AppAction[] = [];
        const dispatch = (a: AppAction) => { actions.push(a); };

        bridge.createMessageListener(dispatch);
        dispatchMessage({ type: 'CALL_INITIATED', callId: 'abc-123' });

        assert.strictEqual(actions.length, 1);
        assert.strictEqual(actions[0].type, 'CALL_INITIATED');
        assert.strictEqual((actions[0] as any).callId, 'abc-123');
    });

    test('CALL_IN_PROGRESS message dispatches correctly', () => {
        const bridge = requireBridge();
        const actions: AppAction[] = [];
        const dispatch = (a: AppAction) => { actions.push(a); };

        bridge.createMessageListener(dispatch);
        dispatchMessage({ type: 'CALL_IN_PROGRESS' });

        assert.strictEqual(actions.length, 1);
        assert.strictEqual(actions[0].type, 'CALL_IN_PROGRESS');
    });

    test('CALL_ENDED message dispatches correctly', () => {
        const bridge = requireBridge();
        const actions: AppAction[] = [];
        const dispatch = (a: AppAction) => { actions.push(a); };

        bridge.createMessageListener(dispatch);
        dispatchMessage({ type: 'CALL_ENDED' });

        assert.strictEqual(actions.length, 1);
        assert.strictEqual(actions[0].type, 'CALL_ENDED');
    });

    test('CALL_ERROR message dispatches with error message', () => {
        const bridge = requireBridge();
        const actions: AppAction[] = [];
        const dispatch = (a: AppAction) => { actions.push(a); };

        bridge.createMessageListener(dispatch);
        dispatchMessage({ type: 'CALL_ERROR', message: 'Twilio failed' });

        assert.strictEqual(actions.length, 1);
        assert.strictEqual(actions[0].type, 'CALL_ERROR');
        assert.strictEqual((actions[0] as any).message, 'Twilio failed');
    });

    test('unknown message type is ignored', () => {
        const bridge = requireBridge();
        const actions: AppAction[] = [];
        const dispatch = (a: AppAction) => { actions.push(a); };

        bridge.createMessageListener(dispatch);
        dispatchMessage({ type: 'UNKNOWN_MESSAGE' } as any);

        assert.strictEqual(actions.length, 0);
    });

    test('null/undefined message data is ignored', () => {
        const bridge = requireBridge();
        const actions: AppAction[] = [];
        const dispatch = (a: AppAction) => { actions.push(a); };

        bridge.createMessageListener(dispatch);
        const event = { data: null } as MessageEvent;
        for (const listener of listeners) {
            listener(event);
        }

        assert.strictEqual(actions.length, 0);
    });

    test('message without type field is ignored', () => {
        const bridge = requireBridge();
        const actions: AppAction[] = [];
        const dispatch = (a: AppAction) => { actions.push(a); };

        bridge.createMessageListener(dispatch);
        const event = { data: { foo: 'bar' } } as MessageEvent;
        for (const listener of listeners) {
            listener(event);
        }

        assert.strictEqual(actions.length, 0);
    });

    test('cleanup removes listener', () => {
        const bridge = requireBridge();
        const actions: AppAction[] = [];
        const dispatch = (a: AppAction) => { actions.push(a); };

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
        const actions1: AppAction[] = [];
        const actions2: AppAction[] = [];

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
        const actions: AppAction[] = [];
        const dispatch = (a: AppAction) => { actions.push(a); };

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
