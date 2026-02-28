"use strict";
/**
 * Type-level integration tests for the frontend type system.
 *
 * These tests verify that the type definitions are correct and
 * that the runtime representation matches expectations.
 * They also serve as living documentation for the type contracts
 * between the frontend and the extension host.
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
const reducer_1 = require("../frontend/reducer");
suite('Types — UIState exhaustiveness', () => {
    const ALL_UI_STATES = [
        'BOOTING', 'BUG_ALERT', 'BRIEFING_HOLD', 'TRAINING_SPLASH',
        'IDLE', 'ANALYZING', 'RESULT_FAIL', 'RESULT_PASS', 'MISSION_COMPLETE',
    ];
    test('there are exactly 9 UI states', () => {
        assert.strictEqual(ALL_UI_STATES.length, 9);
    });
    test('no duplicate UI states', () => {
        const unique = new Set(ALL_UI_STATES);
        assert.strictEqual(unique.size, ALL_UI_STATES.length);
    });
});
suite('Types — SergeantMood exhaustiveness', () => {
    const ALL_MOODS = [
        'idle', 'suspicious', 'yelling', 'angry', 'disappointed', 'proud',
    ];
    test('there are exactly 6 moods', () => {
        assert.strictEqual(ALL_MOODS.length, 6);
    });
    test('no duplicate moods', () => {
        const unique = new Set(ALL_MOODS);
        assert.strictEqual(unique.size, ALL_MOODS.length);
    });
});
suite('Types — CallStatus exhaustiveness', () => {
    const ALL_CALL_STATUSES = [
        'idle', 'requested', 'calling', 'in-progress', 'ended', 'error',
    ];
    test('there are exactly 6 call statuses', () => {
        assert.strictEqual(ALL_CALL_STATUSES.length, 6);
    });
});
suite('Types — AppState shape', () => {
    test('initialState has all required AppState fields', () => {
        const fields = [
            'uiState', 'code', 'challengeLanguage', 'missionInstructions',
            'dialogueLog', 'resultMessage', 'punishment', 'punishmentPhrase',
            'punishmentRequiredReps', 'punishmentProgress', 'retryUnlocked',
            'attemptCount', 'callStatus', 'callId', 'callError', 'phoneNumber',
        ];
        for (const field of fields) {
            assert.ok(field in reducer_1.initialState, `initialState should have field "${field}"`);
        }
    });
    test('initialState field types are correct', () => {
        assert.strictEqual(typeof reducer_1.initialState.uiState, 'string');
        assert.strictEqual(typeof reducer_1.initialState.code, 'string');
        assert.strictEqual(typeof reducer_1.initialState.challengeLanguage, 'string');
        assert.strictEqual(typeof reducer_1.initialState.missionInstructions, 'string');
        assert.ok(Array.isArray(reducer_1.initialState.dialogueLog));
        assert.strictEqual(typeof reducer_1.initialState.resultMessage, 'string');
        assert.strictEqual(typeof reducer_1.initialState.punishment, 'string');
        assert.strictEqual(typeof reducer_1.initialState.punishmentPhrase, 'string');
        assert.strictEqual(typeof reducer_1.initialState.punishmentRequiredReps, 'number');
        assert.strictEqual(typeof reducer_1.initialState.punishmentProgress, 'number');
        assert.strictEqual(typeof reducer_1.initialState.retryUnlocked, 'boolean');
        assert.strictEqual(typeof reducer_1.initialState.attemptCount, 'number');
        assert.strictEqual(typeof reducer_1.initialState.callStatus, 'string');
        assert.strictEqual(typeof reducer_1.initialState.callId, 'string');
        assert.strictEqual(typeof reducer_1.initialState.callError, 'string');
        assert.strictEqual(typeof reducer_1.initialState.phoneNumber, 'string');
    });
});
suite('Types — PersistedPanelState contract', () => {
    test('valid persisted state shape', () => {
        const state = {
            version: 1,
            appState: reducer_1.initialState,
            timeLeftSec: 60,
            savedAt: Date.now(),
        };
        assert.strictEqual(state.version, 1);
        assert.strictEqual(state.timeLeftSec, 60);
        assert.ok(state.savedAt > 0);
        assert.strictEqual(state.appState.uiState, 'BOOTING');
    });
});
suite('Types — ExtensionMessage contract', () => {
    test('ANALYZE_START message shape', () => {
        const msg = { type: 'ANALYZE_START' };
        assert.strictEqual(msg.type, 'ANALYZE_START');
    });
    test('RESULT_FAIL message shape with all optional fields', () => {
        const msg = {
            type: 'RESULT_FAIL',
            message: 'Bug found',
            punishment: 'DROP 20',
            punishmentPhrase: 'I WILL DO BETTER',
            punishmentReps: 10,
        };
        assert.strictEqual(msg.type, 'RESULT_FAIL');
        assert.strictEqual(msg.message, 'Bug found');
    });
    test('RESULT_FAIL message shape with minimal fields', () => {
        const msg = {
            type: 'RESULT_FAIL',
            message: 'Error',
        };
        assert.strictEqual(msg.type, 'RESULT_FAIL');
    });
    test('RESULT_PASS message shape', () => {
        const msg = { type: 'RESULT_PASS', message: 'Fixed!' };
        assert.strictEqual(msg.message, 'Fixed!');
    });
    test('CHALLENGE_LOADED message shape', () => {
        const msg = {
            type: 'CHALLENGE_LOADED',
            challenge: { language: 'python', code: 'x = 1', instructions: 'Fix it' },
        };
        assert.strictEqual(msg.type, 'CHALLENGE_LOADED');
        assert.strictEqual(msg.challenge.language, 'python');
    });
    test('CALL_INITIATED message shape', () => {
        const msg = { type: 'CALL_INITIATED', callId: 'abc-123' };
        assert.strictEqual(msg.callId, 'abc-123');
    });
    test('CALL_ERROR message shape', () => {
        const msg = { type: 'CALL_ERROR', message: 'Twilio failed' };
        assert.strictEqual(msg.message, 'Twilio failed');
    });
});
suite('Types — AppAction exhaustive coverage', () => {
    test('all action types can be constructed', () => {
        const actions = [
            { type: 'BOOT_COMPLETE' },
            { type: 'BUG_ALERT_COMPLETE' },
            { type: 'TRAINING_SPLASH_COMPLETE' },
            { type: 'SUBMIT_CODE' },
            { type: 'ANALYZE_START' },
            { type: 'RESULT_FAIL', message: 'err' },
            { type: 'RESULT_FAIL', message: 'err', punishment: 'p', punishmentPhrase: 'ph', punishmentReps: 5 },
            { type: 'RESULT_PASS', message: 'ok' },
            { type: 'SET_CODE', code: 'x' },
            { type: 'CHALLENGE_LOADED', code: 'x', language: 'py', instructions: 'fix' },
            { type: 'PUNISHMENT_LINE_COMPLETED' },
            { type: 'RETRY' },
            { type: 'NEXT_MISSION' },
            { type: 'SET_PHONE_NUMBER', phoneNumber: '+1234' },
            { type: 'CALL_REQUESTED' },
            { type: 'CALL_INITIATED', callId: 'id' },
            { type: 'CALL_IN_PROGRESS' },
            { type: 'CALL_ENDED' },
            { type: 'CALL_ERROR', message: 'err' },
            { type: 'CALL_DISMISSED' },
        ];
        // Verify each can be constructed without TypeScript errors
        assert.strictEqual(actions.length, 20);
        for (const action of actions) {
            assert.ok(typeof action.type === 'string');
        }
    });
});
//# sourceMappingURL=types.test.js.map