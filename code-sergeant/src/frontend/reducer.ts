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
  challengeLanguage: '',
  missionInstructions: '',
  dialogueLog: [],
  resultMessage: '',
  punishment: '',
  punishmentPhrase: PUNISHMENT_PHRASE,
  punishmentRequiredReps: PUNISHMENT_REQUIRED_REPS,
  punishmentProgress: 0,
  retryUnlocked: false,
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
        uiState: 'BUG_ALERT',
      };

    case 'BUG_ALERT_COMPLETE':
      if (state.uiState !== 'BUG_ALERT') return state;
      return {
        ...state,
        uiState: 'TRAINING_SPLASH',
        dialogueLog: addDialogue(state.dialogueLog, randomItem(DIALOGUE.alert)),
      };

    case 'TRAINING_SPLASH_COMPLETE':
      if (state.uiState !== 'TRAINING_SPLASH') return state;
      return {
        ...state,
        uiState: 'BRIEFING_HOLD',
        dialogueLog: addDialogue(state.dialogueLog, randomItem(DIALOGUE.briefing)),
      };

    case 'SET_CODE':
      return { ...state, code: action.code };

    case 'CHALLENGE_LOADED':
      // Idempotent: skip if already loaded with the same challenge
      if (
        state.code === action.code &&
        state.challengeLanguage === action.language &&
        state.missionInstructions === action.instructions
      ) {
        return state;
      }
      const nextUiState = state.uiState === 'BRIEFING_HOLD' ? 'IDLE' : state.uiState;
      return {
        ...state,
        uiState: nextUiState,
        code: action.code,
        challengeLanguage: action.language,
        missionInstructions: action.instructions,
        dialogueLog: addDialogue(
          state.dialogueLog,
          `MISSION BRIEFING: ${action.instructions}`
        ),
      };

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

    case 'RESULT_FAIL': {
      if (state.uiState !== 'ANALYZING' && state.uiState !== 'IDLE') return state;
      const normalizedPhrase = action.punishmentPhrase?.trim();
      const punishmentPhrase = normalizedPhrase && normalizedPhrase.length > 0
        ? normalizedPhrase
        : PUNISHMENT_PHRASE;
      const punishmentRequiredReps =
        typeof action.punishmentReps === 'number' && Number.isFinite(action.punishmentReps) && action.punishmentReps > 0
          ? action.punishmentReps
          : 0;
      const punishmentOverride = action.punishment?.trim();
      const punishmentText = punishmentOverride && punishmentOverride.length > 0
        ? punishmentOverride
        : `TYPE "${punishmentPhrase}" ${punishmentRequiredReps} TIMES.`;
      return {
        ...state,
        uiState: 'RESULT_FAIL',
        resultMessage: action.message,
        punishment: punishmentText,
        punishmentPhrase,
        punishmentRequiredReps,
        punishmentProgress: 0,
        retryUnlocked: punishmentRequiredReps === 0,
        attemptCount: state.attemptCount + 1,
        dialogueLog: addDialogue(
          state.dialogueLog,
          `${randomItem(DIALOGUE.fail)} ${action.message}`,
          'fail'
        ),
      };
    }

    case 'PUNISHMENT_LINE_COMPLETED':
      if (state.uiState !== 'RESULT_FAIL' || state.retryUnlocked) return state;
      const nextProgress = Math.min(
        state.punishmentProgress + 1,
        state.punishmentRequiredReps
      );
      return {
        ...state,
        punishmentProgress: nextProgress,
        retryUnlocked: nextProgress >= state.punishmentRequiredReps,
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
      if (state.uiState !== 'RESULT_FAIL' || !state.retryUnlocked) return state;
      return {
        ...state,
        uiState: 'IDLE',
        punishment: '',
        punishmentPhrase: PUNISHMENT_PHRASE,
        punishmentRequiredReps: PUNISHMENT_REQUIRED_REPS,
        punishmentProgress: 0,
        retryUnlocked: false,
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

    case 'CALL_REQUESTED':
      return {
        ...state,
        callStatus: 'requested',
        callError: '',
        dialogueLog: addDialogue(
          state.dialogueLog,
          'THE SERGEANT NEEDS TO SPEAK TO YOU. PROVIDE YOUR NUMBER, RECRUIT.'
        ),
      };

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

    case 'CALL_DISMISSED':
      return {
        ...state,
        callStatus: 'idle',
        callId: '',
        callError: '',
      };

    default:
      return state;
  }
}
