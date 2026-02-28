/* =========================================
 * Sergeant Debugger — State Machine Reducer
 * =========================================
 * Deterministic reducer managing all UI state transitions.
 *
 * Transitions:
 *   BOOTING → TRAINING_SPLASH → IDLE
 *   IDLE → ANALYZING (on submit)
 *   ANALYZING → RESULT_FAIL | RESULT_PASS (on message)
 *   RESULT_FAIL → IDLE (on retry)
 *   RESULT_PASS → MISSION_COMPLETE (on next mission)
 * ========================================= */

import type { AppState, AppAction, DialogueEntry } from './types';
import { DIALOGUE, PUNISHMENT_PHRASE, PUNISHMENT_REQUIRED_REPS } from './config';

/** Pick a random item from an array */
function randomItem<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Append a new dialogue entry to the log */
function addDialogue(
  log: DialogueEntry[],
  text: string,
  type: 'normal' | 'fail' = 'normal'
): DialogueEntry[] {
  return [...log, { text, timestamp: Date.now(), type }];
}

/** Initial application state */
export const initialState: AppState = {
  uiState: 'BOOTING',
  code: '',
  dialogueLog: [],
  resultMessage: '',
  punishment: '',
  punishmentProgress: 0,
  attemptCount: 0,
  callStatus: 'idle',
  callId: '',
  callError: '',
  phoneNumber: '',
};

/** Main application reducer */
export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'BOOT_COMPLETE':
      if (state.uiState !== 'BOOTING') return state;
      return {
        ...state,
        uiState: 'TRAINING_SPLASH',
      };

    case 'TRAINING_SPLASH_COMPLETE':
      if (state.uiState !== 'TRAINING_SPLASH') return state;
      return {
        ...state,
        uiState: 'IDLE',
        dialogueLog: addDialogue(state.dialogueLog, randomItem(DIALOGUE.idle)),
      };

    case 'SET_CODE':
      return { ...state, code: action.code };

    case 'SUBMIT_CODE':
      if (state.uiState !== 'IDLE') return state;
      return {
        ...state,
        uiState: 'ANALYZING',
        dialogueLog: addDialogue(state.dialogueLog, randomItem(DIALOGUE.analyzing)),
      };

    case 'ANALYZE_START':
      if (state.uiState !== 'IDLE' && state.uiState !== 'ANALYZING') return state;
      return {
        ...state,
        uiState: 'ANALYZING',
        dialogueLog:
          state.uiState !== 'ANALYZING'
            ? addDialogue(state.dialogueLog, randomItem(DIALOGUE.analyzing))
            : state.dialogueLog,
      };

    case 'RESULT_FAIL':
      if (state.uiState !== 'ANALYZING' && state.uiState !== 'IDLE') return state;
      return {
        ...state,
        uiState: 'RESULT_FAIL',
        resultMessage: action.message,
        punishment: `TYPE "${PUNISHMENT_PHRASE}" ${PUNISHMENT_REQUIRED_REPS} TIMES.`,
        punishmentProgress: 0,
        attemptCount: state.attemptCount + 1,
        dialogueLog: addDialogue(
          state.dialogueLog,
          `${randomItem(DIALOGUE.fail)} ${action.message}`,
          'fail'
        ),
      };

    case 'PUNISHMENT_LINE_COMPLETED':
      if (state.uiState !== 'RESULT_FAIL') return state;
      return {
        ...state,
        punishmentProgress: Math.min(
          state.punishmentProgress + 1,
          PUNISHMENT_REQUIRED_REPS
        ),
      };

    case 'RESULT_PASS':
      if (state.uiState !== 'ANALYZING') return state;
      return {
        ...state,
        uiState: 'RESULT_PASS',
        resultMessage: action.message,
        dialogueLog: addDialogue(state.dialogueLog, randomItem(DIALOGUE.pass)),
      };

    case 'RETRY':
      if (state.uiState !== 'RESULT_FAIL') return state;
      if (state.punishmentProgress < PUNISHMENT_REQUIRED_REPS) return state;
      return {
        ...state,
        uiState: 'IDLE',
        punishment: '',
        punishmentProgress: 0,
        resultMessage: '',
        dialogueLog: addDialogue(state.dialogueLog, randomItem(DIALOGUE.idle)),
      };

    case 'NEXT_MISSION':
      if (state.uiState !== 'RESULT_PASS') return state;
      return {
        ...state,
        uiState: 'MISSION_COMPLETE',
      };

    // ── Phone call actions ──────────────────────────────────
    case 'SET_PHONE_NUMBER':
      return { ...state, phoneNumber: action.phoneNumber };

    case 'CALL_INITIATED':
      return {
        ...state,
        callStatus: 'calling',
        callId: action.callId,
        callError: '',
        dialogueLog: addDialogue(
          state.dialogueLog,
          'CALLING IN THE SERGEANT… STAND BY FOR VERBAL BOMBARDMENT.'
        ),
      };

    case 'CALL_IN_PROGRESS':
      return {
        ...state,
        callStatus: 'in-progress',
        dialogueLog: addDialogue(
          state.dialogueLog,
          'SERGEANT IS ON THE LINE. ANSWER YOUR PHONE, SOLDIER!'
        ),
      };

    case 'CALL_ENDED':
      return {
        ...state,
        callStatus: 'ended',
        dialogueLog: addDialogue(
          state.dialogueLog,
          'SERGEANT HAS HUNG UP. NOW GET BACK TO WORK.'
        ),
      };

    case 'CALL_ERROR':
      return {
        ...state,
        callStatus: 'error',
        callError: action.message,
        dialogueLog: addDialogue(
          state.dialogueLog,
          `COMMS FAILURE: ${action.message}`,
          'fail'
        ),
      };

    default:
      return state;
  }
}
