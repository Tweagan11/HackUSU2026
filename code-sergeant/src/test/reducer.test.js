"use strict";
/**
 * Integration tests for the frontend state-machine reducer.
 *
 * Exercises every action type, every state transition, and all edge
 * cases (invalid transitions, boundary values, idempotency).
 *
 * Run via: npx mocha out/test/reducer.test.js
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
const config_1 = require("../frontend/config");
/**
 * Helper: dispatch a sequence of actions and return the final state.
 */
function reduceAll(actions, start = reducer_1.initialState) {
    return actions.reduce((state, action) => (0, reducer_1.appReducer)(state, action), start);
}
suite('Reducer — Initial State', () => {
    test('initial state has correct defaults', () => {
        assert.strictEqual(reducer_1.initialState.uiState, 'BOOTING');
        assert.strictEqual(reducer_1.initialState.code, '');
        assert.strictEqual(reducer_1.initialState.challengeLanguage, '');
        assert.strictEqual(reducer_1.initialState.missionInstructions, '');
        assert.deepStrictEqual(reducer_1.initialState.dialogueLog, []);
        assert.strictEqual(reducer_1.initialState.resultMessage, '');
        assert.strictEqual(reducer_1.initialState.punishment, '');
        assert.strictEqual(reducer_1.initialState.punishmentPhrase, config_1.PUNISHMENT_PHRASE);
        assert.strictEqual(reducer_1.initialState.punishmentRequiredReps, config_1.PUNISHMENT_REQUIRED_REPS);
        assert.strictEqual(reducer_1.initialState.punishmentProgress, 0);
        assert.strictEqual(reducer_1.initialState.retryUnlocked, false);
        assert.strictEqual(reducer_1.initialState.attemptCount, 0);
        assert.strictEqual(reducer_1.initialState.callStatus, 'idle');
        assert.strictEqual(reducer_1.initialState.callId, '');
        assert.strictEqual(reducer_1.initialState.callError, '');
        assert.strictEqual(reducer_1.initialState.phoneNumber, '');
    });
});
suite('Reducer — Boot Sequence', () => {
    test('BOOT_COMPLETE transitions from BOOTING to BUG_ALERT', () => {
        const state = (0, reducer_1.appReducer)(reducer_1.initialState, { type: 'BOOT_COMPLETE' });
        assert.strictEqual(state.uiState, 'BUG_ALERT');
    });
    test('BOOT_COMPLETE is no-op when not in BOOTING', () => {
        const idle = { ...reducer_1.initialState, uiState: 'IDLE' };
        const state = (0, reducer_1.appReducer)(idle, { type: 'BOOT_COMPLETE' });
        assert.strictEqual(state.uiState, 'IDLE');
    });
    test('BUG_ALERT_COMPLETE transitions from BUG_ALERT to TRAINING_SPLASH', () => {
        const bugAlert = { ...reducer_1.initialState, uiState: 'BUG_ALERT' };
        const state = (0, reducer_1.appReducer)(bugAlert, { type: 'BUG_ALERT_COMPLETE' });
        assert.strictEqual(state.uiState, 'TRAINING_SPLASH');
        assert.ok(state.dialogueLog.length > 0, 'should add dialogue');
    });
    test('BUG_ALERT_COMPLETE is no-op when not in BUG_ALERT', () => {
        const state = (0, reducer_1.appReducer)(reducer_1.initialState, { type: 'BUG_ALERT_COMPLETE' });
        assert.strictEqual(state.uiState, 'BOOTING');
    });
    test('TRAINING_SPLASH_COMPLETE transitions to BRIEFING_HOLD', () => {
        const splash = { ...reducer_1.initialState, uiState: 'TRAINING_SPLASH' };
        const state = (0, reducer_1.appReducer)(splash, { type: 'TRAINING_SPLASH_COMPLETE' });
        assert.strictEqual(state.uiState, 'BRIEFING_HOLD');
        assert.ok(state.dialogueLog.length > 0, 'should add dialogue');
    });
    test('TRAINING_SPLASH_COMPLETE is no-op when not TRAINING_SPLASH', () => {
        const idle = { ...reducer_1.initialState, uiState: 'IDLE' };
        const state = (0, reducer_1.appReducer)(idle, { type: 'TRAINING_SPLASH_COMPLETE' });
        assert.strictEqual(state.uiState, 'IDLE');
    });
    test('full boot sequence: BOOTING → BUG_ALERT → TRAINING_SPLASH → BRIEFING_HOLD', () => {
        const state = reduceAll([
            { type: 'BOOT_COMPLETE' },
            { type: 'BUG_ALERT_COMPLETE' },
            { type: 'TRAINING_SPLASH_COMPLETE' },
        ]);
        assert.strictEqual(state.uiState, 'BRIEFING_HOLD');
        assert.ok(state.dialogueLog.length >= 2, 'should have alert + briefing dialogue');
    });
});
suite('Reducer — Challenge Loading', () => {
    test('CHALLENGE_LOADED sets code, language, and instructions', () => {
        const briefing = { ...reducer_1.initialState, uiState: 'BRIEFING_HOLD' };
        const state = (0, reducer_1.appReducer)(briefing, {
            type: 'CHALLENGE_LOADED',
            code: 'x = 1 / 0',
            language: 'python',
            instructions: 'Fix the division by zero',
        });
        assert.strictEqual(state.code, 'x = 1 / 0');
        assert.strictEqual(state.challengeLanguage, 'python');
        assert.strictEqual(state.missionInstructions, 'Fix the division by zero');
    });
    test('CHALLENGE_LOADED transitions from BRIEFING_HOLD to IDLE', () => {
        const briefing = { ...reducer_1.initialState, uiState: 'BRIEFING_HOLD' };
        const state = (0, reducer_1.appReducer)(briefing, {
            type: 'CHALLENGE_LOADED',
            code: 'x = 1',
            language: 'python',
            instructions: 'Fix it',
        });
        assert.strictEqual(state.uiState, 'IDLE');
    });
    test('CHALLENGE_LOADED does NOT change uiState when not BRIEFING_HOLD', () => {
        const idle = { ...reducer_1.initialState, uiState: 'IDLE' };
        const state = (0, reducer_1.appReducer)(idle, {
            type: 'CHALLENGE_LOADED',
            code: 'new code',
            language: 'js',
            instructions: 'new instructions',
        });
        assert.strictEqual(state.uiState, 'IDLE');
        assert.strictEqual(state.code, 'new code');
    });
    test('CHALLENGE_LOADED is idempotent for same challenge', () => {
        const existing = {
            ...reducer_1.initialState,
            uiState: 'IDLE',
            code: 'x = 1',
            challengeLanguage: 'python',
            missionInstructions: 'Fix it',
        };
        const state = (0, reducer_1.appReducer)(existing, {
            type: 'CHALLENGE_LOADED',
            code: 'x = 1',
            language: 'python',
            instructions: 'Fix it',
        });
        assert.strictEqual(state, existing); // reference equality — no change
    });
    test('CHALLENGE_LOADED adds MISSION BRIEFING to dialogue', () => {
        const briefing = { ...reducer_1.initialState, uiState: 'BRIEFING_HOLD' };
        const state = (0, reducer_1.appReducer)(briefing, {
            type: 'CHALLENGE_LOADED',
            code: 'x = 1',
            language: 'python',
            instructions: 'Fix the bug',
        });
        const last = state.dialogueLog[state.dialogueLog.length - 1];
        assert.ok(last.text.includes('MISSION BRIEFING'));
        assert.ok(last.text.includes('Fix the bug'));
    });
});
suite('Reducer — Code Editing', () => {
    test('SET_CODE updates the code', () => {
        const state = (0, reducer_1.appReducer)(reducer_1.initialState, { type: 'SET_CODE', code: 'print("hi")' });
        assert.strictEqual(state.code, 'print("hi")');
    });
    test('SET_CODE to empty string', () => {
        const withCode = { ...reducer_1.initialState, code: 'something' };
        const state = (0, reducer_1.appReducer)(withCode, { type: 'SET_CODE', code: '' });
        assert.strictEqual(state.code, '');
    });
    test('SET_CODE preserves other state', () => {
        const withDialogue = {
            ...reducer_1.initialState,
            dialogueLog: [{ text: 'test', timestamp: 0 }],
            attemptCount: 3,
        };
        const state = (0, reducer_1.appReducer)(withDialogue, { type: 'SET_CODE', code: 'new' });
        assert.strictEqual(state.code, 'new');
        assert.strictEqual(state.attemptCount, 3);
        assert.strictEqual(state.dialogueLog.length, 1);
    });
});
suite('Reducer — Submission Flow', () => {
    test('SUBMIT_CODE transitions from IDLE to ANALYZING', () => {
        const idle = { ...reducer_1.initialState, uiState: 'IDLE' };
        const state = (0, reducer_1.appReducer)(idle, { type: 'SUBMIT_CODE' });
        assert.strictEqual(state.uiState, 'ANALYZING');
        assert.ok(state.dialogueLog.length > 0, 'should add dialogue');
    });
    test('SUBMIT_CODE is no-op when not IDLE', () => {
        const analyzing = { ...reducer_1.initialState, uiState: 'ANALYZING' };
        const state = (0, reducer_1.appReducer)(analyzing, { type: 'SUBMIT_CODE' });
        assert.strictEqual(state.uiState, 'ANALYZING');
    });
    test('ANALYZE_START transitions from IDLE to ANALYZING', () => {
        const idle = { ...reducer_1.initialState, uiState: 'IDLE' };
        const state = (0, reducer_1.appReducer)(idle, { type: 'ANALYZE_START' });
        assert.strictEqual(state.uiState, 'ANALYZING');
    });
    test('ANALYZE_START from ANALYZING stays in ANALYZING (no duplicate dialogue)', () => {
        const analyzing = {
            ...reducer_1.initialState,
            uiState: 'ANALYZING',
            dialogueLog: [{ text: 'existing', timestamp: 0 }],
        };
        const state = (0, reducer_1.appReducer)(analyzing, { type: 'ANALYZE_START' });
        assert.strictEqual(state.uiState, 'ANALYZING');
        assert.strictEqual(state.dialogueLog.length, 1); // no new dialogue added
    });
    test('ANALYZE_START is no-op from RESULT_FAIL', () => {
        const fail = { ...reducer_1.initialState, uiState: 'RESULT_FAIL' };
        const state = (0, reducer_1.appReducer)(fail, { type: 'ANALYZE_START' });
        assert.strictEqual(state.uiState, 'RESULT_FAIL');
    });
});
suite('Reducer — Result FAIL', () => {
    test('RESULT_FAIL transitions from ANALYZING to RESULT_FAIL', () => {
        const analyzing = { ...reducer_1.initialState, uiState: 'ANALYZING' };
        const state = (0, reducer_1.appReducer)(analyzing, {
            type: 'RESULT_FAIL',
            message: 'NullPointerException',
        });
        assert.strictEqual(state.uiState, 'RESULT_FAIL');
        assert.strictEqual(state.resultMessage, 'NullPointerException');
        assert.strictEqual(state.attemptCount, 1);
        assert.strictEqual(state.punishmentProgress, 0);
        assert.strictEqual(state.retryUnlocked, false);
    });
    test('RESULT_FAIL from IDLE also works', () => {
        const idle = { ...reducer_1.initialState, uiState: 'IDLE' };
        const state = (0, reducer_1.appReducer)(idle, { type: 'RESULT_FAIL', message: 'Timeout' });
        assert.strictEqual(state.uiState, 'RESULT_FAIL');
    });
    test('RESULT_FAIL is no-op from RESULT_PASS', () => {
        const pass = { ...reducer_1.initialState, uiState: 'RESULT_PASS' };
        const state = (0, reducer_1.appReducer)(pass, { type: 'RESULT_FAIL', message: 'late fail' });
        assert.strictEqual(state.uiState, 'RESULT_PASS');
    });
    test('RESULT_FAIL with custom punishment text', () => {
        const analyzing = { ...reducer_1.initialState, uiState: 'ANALYZING' };
        const state = (0, reducer_1.appReducer)(analyzing, {
            type: 'RESULT_FAIL',
            message: 'Error',
            punishment: 'DROP AND GIVE ME 20!',
        });
        assert.strictEqual(state.punishment, 'DROP AND GIVE ME 20!');
    });
    test('RESULT_FAIL with custom phrase and reps', () => {
        const analyzing = { ...reducer_1.initialState, uiState: 'ANALYZING' };
        const state = (0, reducer_1.appReducer)(analyzing, {
            type: 'RESULT_FAIL',
            message: 'Error',
            punishmentPhrase: 'I WILL FIX MY BUGS',
            punishmentReps: 5,
        });
        assert.strictEqual(state.punishmentPhrase, 'I WILL FIX MY BUGS');
        assert.strictEqual(state.punishmentRequiredReps, 5);
        assert.ok(state.punishment.includes('I WILL FIX MY BUGS'));
        assert.ok(state.punishment.includes('5'));
    });
    test('RESULT_FAIL with zero reps falls back to default (not immediate unlock)', () => {
        const analyzing = { ...reducer_1.initialState, uiState: 'ANALYZING' };
        const state = (0, reducer_1.appReducer)(analyzing, {
            type: 'RESULT_FAIL',
            message: 'Error',
            punishmentReps: 0,
        });
        // 0 is not > 0, so reducer treats it as invalid → falls back to PUNISHMENT_REQUIRED_REPS
        assert.strictEqual(state.punishmentRequiredReps, config_1.PUNISHMENT_REQUIRED_REPS);
        assert.strictEqual(state.retryUnlocked, false);
    });
    test('RESULT_FAIL with empty punishment phrase uses defaults', () => {
        const analyzing = { ...reducer_1.initialState, uiState: 'ANALYZING' };
        const state = (0, reducer_1.appReducer)(analyzing, {
            type: 'RESULT_FAIL',
            message: 'Error',
            punishmentPhrase: '',
        });
        assert.strictEqual(state.punishmentPhrase, config_1.PUNISHMENT_PHRASE);
    });
    test('RESULT_FAIL with whitespace-only phrase uses defaults', () => {
        const analyzing = { ...reducer_1.initialState, uiState: 'ANALYZING' };
        const state = (0, reducer_1.appReducer)(analyzing, {
            type: 'RESULT_FAIL',
            message: 'Error',
            punishmentPhrase: '   ',
        });
        assert.strictEqual(state.punishmentPhrase, config_1.PUNISHMENT_PHRASE);
    });
    test('RESULT_FAIL with negative reps uses default', () => {
        const analyzing = { ...reducer_1.initialState, uiState: 'ANALYZING' };
        const state = (0, reducer_1.appReducer)(analyzing, {
            type: 'RESULT_FAIL',
            message: 'Error',
            punishmentReps: -5,
        });
        assert.strictEqual(state.punishmentRequiredReps, config_1.PUNISHMENT_REQUIRED_REPS);
    });
    test('RESULT_FAIL with NaN reps uses default', () => {
        const analyzing = { ...reducer_1.initialState, uiState: 'ANALYZING' };
        const state = (0, reducer_1.appReducer)(analyzing, {
            type: 'RESULT_FAIL',
            message: 'Error',
            punishmentReps: NaN,
        });
        assert.strictEqual(state.punishmentRequiredReps, config_1.PUNISHMENT_REQUIRED_REPS);
    });
    test('RESULT_FAIL with Infinity reps uses default', () => {
        const analyzing = { ...reducer_1.initialState, uiState: 'ANALYZING' };
        const state = (0, reducer_1.appReducer)(analyzing, {
            type: 'RESULT_FAIL',
            message: 'Error',
            punishmentReps: Infinity,
        });
        assert.strictEqual(state.punishmentRequiredReps, config_1.PUNISHMENT_REQUIRED_REPS);
    });
    test('RESULT_FAIL increments attemptCount', () => {
        const analyzing = { ...reducer_1.initialState, uiState: 'ANALYZING', attemptCount: 2 };
        const state = (0, reducer_1.appReducer)(analyzing, { type: 'RESULT_FAIL', message: 'fail' });
        assert.strictEqual(state.attemptCount, 3);
    });
    test('RESULT_FAIL adds fail-type dialogue', () => {
        const analyzing = { ...reducer_1.initialState, uiState: 'ANALYZING' };
        const state = (0, reducer_1.appReducer)(analyzing, { type: 'RESULT_FAIL', message: 'Bug found' });
        const last = state.dialogueLog[state.dialogueLog.length - 1];
        assert.strictEqual(last.type, 'fail');
        assert.ok(last.text.includes('Bug found'));
    });
});
suite('Reducer — Punishment', () => {
    test('PUNISHMENT_LINE_COMPLETED increments progress', () => {
        const fail = {
            ...reducer_1.initialState,
            uiState: 'RESULT_FAIL',
            punishmentProgress: 0,
            punishmentRequiredReps: 3,
            retryUnlocked: false,
        };
        const state = (0, reducer_1.appReducer)(fail, { type: 'PUNISHMENT_LINE_COMPLETED' });
        assert.strictEqual(state.punishmentProgress, 1);
        assert.strictEqual(state.retryUnlocked, false);
    });
    test('PUNISHMENT_LINE_COMPLETED unlocks retry at required reps', () => {
        const fail = {
            ...reducer_1.initialState,
            uiState: 'RESULT_FAIL',
            punishmentProgress: 2,
            punishmentRequiredReps: 3,
            retryUnlocked: false,
        };
        const state = (0, reducer_1.appReducer)(fail, { type: 'PUNISHMENT_LINE_COMPLETED' });
        assert.strictEqual(state.punishmentProgress, 3);
        assert.strictEqual(state.retryUnlocked, true);
    });
    test('PUNISHMENT_LINE_COMPLETED does not exceed required reps', () => {
        const fail = {
            ...reducer_1.initialState,
            uiState: 'RESULT_FAIL',
            punishmentProgress: 10,
            punishmentRequiredReps: 10,
            retryUnlocked: false,
        };
        const state = (0, reducer_1.appReducer)(fail, { type: 'PUNISHMENT_LINE_COMPLETED' });
        assert.strictEqual(state.punishmentProgress, 10);
        assert.strictEqual(state.retryUnlocked, true);
    });
    test('PUNISHMENT_LINE_COMPLETED is no-op when already unlocked', () => {
        const fail = {
            ...reducer_1.initialState,
            uiState: 'RESULT_FAIL',
            punishmentProgress: 5,
            punishmentRequiredReps: 5,
            retryUnlocked: true,
        };
        const state = (0, reducer_1.appReducer)(fail, { type: 'PUNISHMENT_LINE_COMPLETED' });
        assert.strictEqual(state, fail); // reference equality
    });
    test('PUNISHMENT_LINE_COMPLETED is no-op when not in RESULT_FAIL', () => {
        const state = (0, reducer_1.appReducer)(reducer_1.initialState, { type: 'PUNISHMENT_LINE_COMPLETED' });
        assert.strictEqual(state, reducer_1.initialState);
    });
    test('full punishment flow: complete all reps then retry', () => {
        let state = { ...reducer_1.initialState, uiState: 'ANALYZING' };
        // Fail
        state = (0, reducer_1.appReducer)(state, { type: 'RESULT_FAIL', message: 'bug', punishmentReps: 3 });
        assert.strictEqual(state.uiState, 'RESULT_FAIL');
        assert.strictEqual(state.retryUnlocked, false);
        // Complete 3 punishment lines
        state = (0, reducer_1.appReducer)(state, { type: 'PUNISHMENT_LINE_COMPLETED' });
        assert.strictEqual(state.punishmentProgress, 1);
        state = (0, reducer_1.appReducer)(state, { type: 'PUNISHMENT_LINE_COMPLETED' });
        assert.strictEqual(state.punishmentProgress, 2);
        state = (0, reducer_1.appReducer)(state, { type: 'PUNISHMENT_LINE_COMPLETED' });
        assert.strictEqual(state.punishmentProgress, 3);
        assert.strictEqual(state.retryUnlocked, true);
        // Retry
        state = (0, reducer_1.appReducer)(state, { type: 'RETRY' });
        assert.strictEqual(state.uiState, 'IDLE');
        assert.strictEqual(state.punishmentProgress, 0);
        assert.strictEqual(state.retryUnlocked, false);
        assert.strictEqual(state.punishment, '');
    });
});
suite('Reducer — Result PASS', () => {
    test('RESULT_PASS transitions from ANALYZING to RESULT_PASS', () => {
        const analyzing = { ...reducer_1.initialState, uiState: 'ANALYZING' };
        const state = (0, reducer_1.appReducer)(analyzing, { type: 'RESULT_PASS', message: 'Great job!' });
        assert.strictEqual(state.uiState, 'RESULT_PASS');
        assert.strictEqual(state.resultMessage, 'Great job!');
    });
    test('RESULT_PASS is no-op when not ANALYZING', () => {
        const idle = { ...reducer_1.initialState, uiState: 'IDLE' };
        const state = (0, reducer_1.appReducer)(idle, { type: 'RESULT_PASS', message: 'pass' });
        assert.strictEqual(state.uiState, 'IDLE');
    });
    test('RESULT_PASS adds dialogue', () => {
        const analyzing = { ...reducer_1.initialState, uiState: 'ANALYZING' };
        const state = (0, reducer_1.appReducer)(analyzing, { type: 'RESULT_PASS', message: 'Done' });
        assert.ok(state.dialogueLog.length > 0);
    });
});
suite('Reducer — Retry', () => {
    test('RETRY transitions from RESULT_FAIL to IDLE when unlocked', () => {
        const fail = {
            ...reducer_1.initialState,
            uiState: 'RESULT_FAIL',
            retryUnlocked: true,
            punishment: 'some punishment',
            resultMessage: 'error',
        };
        const state = (0, reducer_1.appReducer)(fail, { type: 'RETRY' });
        assert.strictEqual(state.uiState, 'IDLE');
        assert.strictEqual(state.punishment, '');
        assert.strictEqual(state.resultMessage, '');
        assert.strictEqual(state.punishmentProgress, 0);
        assert.strictEqual(state.retryUnlocked, false);
    });
    test('RETRY is no-op when not unlocked', () => {
        const fail = {
            ...reducer_1.initialState,
            uiState: 'RESULT_FAIL',
            retryUnlocked: false,
        };
        const state = (0, reducer_1.appReducer)(fail, { type: 'RETRY' });
        assert.strictEqual(state.uiState, 'RESULT_FAIL');
    });
    test('RETRY is no-op when not in RESULT_FAIL', () => {
        const idle = { ...reducer_1.initialState, uiState: 'IDLE' };
        const state = (0, reducer_1.appReducer)(idle, { type: 'RETRY' });
        assert.strictEqual(state.uiState, 'IDLE');
    });
    test('RETRY resets punishment phrase and reps to defaults', () => {
        const fail = {
            ...reducer_1.initialState,
            uiState: 'RESULT_FAIL',
            retryUnlocked: true,
            punishmentPhrase: 'CUSTOM',
            punishmentRequiredReps: 99,
        };
        const state = (0, reducer_1.appReducer)(fail, { type: 'RETRY' });
        assert.strictEqual(state.punishmentPhrase, config_1.PUNISHMENT_PHRASE);
        assert.strictEqual(state.punishmentRequiredReps, config_1.PUNISHMENT_REQUIRED_REPS);
    });
});
suite('Reducer — Next Mission', () => {
    test('NEXT_MISSION transitions from RESULT_PASS to MISSION_COMPLETE', () => {
        const pass = { ...reducer_1.initialState, uiState: 'RESULT_PASS' };
        const state = (0, reducer_1.appReducer)(pass, { type: 'NEXT_MISSION' });
        assert.strictEqual(state.uiState, 'MISSION_COMPLETE');
    });
    test('NEXT_MISSION is no-op from other states', () => {
        const idle = { ...reducer_1.initialState, uiState: 'IDLE' };
        const state = (0, reducer_1.appReducer)(idle, { type: 'NEXT_MISSION' });
        assert.strictEqual(state.uiState, 'IDLE');
    });
});
suite('Reducer — Phone Call Flow', () => {
    test('SET_PHONE_NUMBER updates phone number', () => {
        const state = (0, reducer_1.appReducer)(reducer_1.initialState, {
            type: 'SET_PHONE_NUMBER',
            phoneNumber: '+11234567890',
        });
        assert.strictEqual(state.phoneNumber, '+11234567890');
    });
    test('CALL_REQUESTED sets status to requested', () => {
        const state = (0, reducer_1.appReducer)(reducer_1.initialState, { type: 'CALL_REQUESTED' });
        assert.strictEqual(state.callStatus, 'requested');
        assert.strictEqual(state.callError, '');
        assert.ok(state.dialogueLog.length > 0);
    });
    test('CALL_INITIATED sets status to calling with callId', () => {
        const requested = { ...reducer_1.initialState, callStatus: 'requested' };
        const state = (0, reducer_1.appReducer)(requested, { type: 'CALL_INITIATED', callId: 'call-123' });
        assert.strictEqual(state.callStatus, 'calling');
        assert.strictEqual(state.callId, 'call-123');
        assert.strictEqual(state.callError, '');
    });
    test('CALL_IN_PROGRESS sets status to in-progress', () => {
        const calling = { ...reducer_1.initialState, callStatus: 'calling' };
        const state = (0, reducer_1.appReducer)(calling, { type: 'CALL_IN_PROGRESS' });
        assert.strictEqual(state.callStatus, 'in-progress');
    });
    test('CALL_ENDED sets status to ended', () => {
        const inProgress = { ...reducer_1.initialState, callStatus: 'in-progress' };
        const state = (0, reducer_1.appReducer)(inProgress, { type: 'CALL_ENDED' });
        assert.strictEqual(state.callStatus, 'ended');
    });
    test('CALL_ERROR sets status to error with message', () => {
        const calling = { ...reducer_1.initialState, callStatus: 'calling' };
        const state = (0, reducer_1.appReducer)(calling, { type: 'CALL_ERROR', message: 'Connection failed' });
        assert.strictEqual(state.callStatus, 'error');
        assert.strictEqual(state.callError, 'Connection failed');
        const last = state.dialogueLog[state.dialogueLog.length - 1];
        assert.strictEqual(last.type, 'fail');
        assert.ok(last.text.includes('Connection failed'));
    });
    test('CALL_DISMISSED resets call state', () => {
        const ended = {
            ...reducer_1.initialState,
            callStatus: 'ended',
            callId: 'call-123',
            callError: '',
        };
        const state = (0, reducer_1.appReducer)(ended, { type: 'CALL_DISMISSED' });
        assert.strictEqual(state.callStatus, 'idle');
        assert.strictEqual(state.callId, '');
        assert.strictEqual(state.callError, '');
    });
    test('full call flow: requested → initiated → in-progress → ended → dismissed', () => {
        let state = (0, reducer_1.appReducer)(reducer_1.initialState, { type: 'CALL_REQUESTED' });
        assert.strictEqual(state.callStatus, 'requested');
        state = (0, reducer_1.appReducer)(state, { type: 'CALL_INITIATED', callId: 'call-999' });
        assert.strictEqual(state.callStatus, 'calling');
        state = (0, reducer_1.appReducer)(state, { type: 'CALL_IN_PROGRESS' });
        assert.strictEqual(state.callStatus, 'in-progress');
        state = (0, reducer_1.appReducer)(state, { type: 'CALL_ENDED' });
        assert.strictEqual(state.callStatus, 'ended');
        state = (0, reducer_1.appReducer)(state, { type: 'CALL_DISMISSED' });
        assert.strictEqual(state.callStatus, 'idle');
    });
    test('call error flow: requested → initiated → error → dismissed', () => {
        let state = (0, reducer_1.appReducer)(reducer_1.initialState, { type: 'CALL_REQUESTED' });
        state = (0, reducer_1.appReducer)(state, { type: 'CALL_INITIATED', callId: 'call-err' });
        state = (0, reducer_1.appReducer)(state, { type: 'CALL_ERROR', message: 'Twilio down' });
        assert.strictEqual(state.callStatus, 'error');
        state = (0, reducer_1.appReducer)(state, { type: 'CALL_DISMISSED' });
        assert.strictEqual(state.callStatus, 'idle');
    });
});
suite('Reducer — Full Integration Scenarios', () => {
    test('happy path: boot → challenge → submit → pass → next mission', () => {
        const state = reduceAll([
            { type: 'BOOT_COMPLETE' },
            { type: 'BUG_ALERT_COMPLETE' },
            { type: 'TRAINING_SPLASH_COMPLETE' },
            { type: 'CHALLENGE_LOADED', code: 'x = None', language: 'python', instructions: 'Fix null' },
            { type: 'SET_CODE', code: 'x = 0' },
            { type: 'SUBMIT_CODE' },
            { type: 'RESULT_PASS', message: 'Bug fixed!' },
            { type: 'NEXT_MISSION' },
        ]);
        assert.strictEqual(state.uiState, 'MISSION_COMPLETE');
        assert.strictEqual(state.resultMessage, 'Bug fixed!');
    });
    test('fail path: boot → challenge → submit → fail → punishment → retry → submit → pass', () => {
        let state = reduceAll([
            { type: 'BOOT_COMPLETE' },
            { type: 'BUG_ALERT_COMPLETE' },
            { type: 'TRAINING_SPLASH_COMPLETE' },
            { type: 'CHALLENGE_LOADED', code: 'x = None', language: 'python', instructions: 'Fix null' },
            { type: 'SUBMIT_CODE' },
            { type: 'RESULT_FAIL', message: 'Still broken', punishmentReps: 2 },
        ]);
        assert.strictEqual(state.uiState, 'RESULT_FAIL');
        assert.strictEqual(state.attemptCount, 1);
        // Complete punishment
        state = (0, reducer_1.appReducer)(state, { type: 'PUNISHMENT_LINE_COMPLETED' });
        state = (0, reducer_1.appReducer)(state, { type: 'PUNISHMENT_LINE_COMPLETED' });
        assert.strictEqual(state.retryUnlocked, true);
        // Retry and succeed
        state = reduceAll([
            { type: 'RETRY' },
            { type: 'SUBMIT_CODE' },
            { type: 'RESULT_PASS', message: 'Fixed!' },
        ], state);
        assert.strictEqual(state.uiState, 'RESULT_PASS');
    });
    test('multiple failures accumulate attemptCount', () => {
        let state = { ...reducer_1.initialState, uiState: 'IDLE' };
        for (let i = 0; i < 5; i++) {
            state = (0, reducer_1.appReducer)(state, { type: 'SUBMIT_CODE' });
            state = (0, reducer_1.appReducer)(state, { type: 'RESULT_FAIL', message: `fail ${i}`, punishmentReps: 2 });
            // Must complete punishment reps before RETRY is accepted
            state = (0, reducer_1.appReducer)(state, { type: 'PUNISHMENT_LINE_COMPLETED' });
            state = (0, reducer_1.appReducer)(state, { type: 'PUNISHMENT_LINE_COMPLETED' });
            assert.strictEqual(state.retryUnlocked, true);
            state = (0, reducer_1.appReducer)(state, { type: 'RETRY' });
        }
        assert.strictEqual(state.attemptCount, 5);
    });
    test('dialogue log accumulates across transitions', () => {
        const state = reduceAll([
            { type: 'BOOT_COMPLETE' },
            { type: 'BUG_ALERT_COMPLETE' },
            { type: 'TRAINING_SPLASH_COMPLETE' },
            { type: 'CHALLENGE_LOADED', code: 'x', language: 'py', instructions: 'Fix' },
            { type: 'SUBMIT_CODE' },
            { type: 'RESULT_FAIL', message: 'err' },
        ]);
        // Should have: alert dialogue + briefing dialogue + mission briefing + analyzing + fail
        assert.ok(state.dialogueLog.length >= 5, `expected >= 5 entries, got ${state.dialogueLog.length}`);
    });
    test('unknown action type is ignored (returns same state)', () => {
        const state = (0, reducer_1.appReducer)(reducer_1.initialState, { type: 'NONEXISTENT' });
        assert.strictEqual(state, reducer_1.initialState);
    });
});
//# sourceMappingURL=reducer.test.js.map