/* =========================================
 * Sergeant Debugger — Type Definitions
 * ========================================= */

/** Deterministic UI states for the state machine */
export type UIState =
  | 'BOOTING'
  | 'BUG_ALERT'
  | 'BRIEFING_HOLD'
  | 'TRAINING_SPLASH'
  | 'IDLE'
  | 'ANALYZING'
  | 'RESULT_FAIL'
  | 'RESULT_PASS'
  | 'MISSION_COMPLETE';

/** Sergeant face mood for sprite/emoji display */
export type SergeantMood =
  | 'idle'
  | 'suspicious'
  | 'yelling'
  | 'angry'
  | 'disappointed'
  | 'proud';

/** Single entry in the dialogue log */
export type DialogueEntry = {
  text: string;
  timestamp: number;
  /** When true, the entry animates with a typewriter effect */
  type?: 'normal' | 'fail';
};

/** Call status for the sergeant phone call feature */
export type CallStatus = 'idle' | 'requested' | 'calling' | 'in-progress' | 'ended' | 'error';

/** Full application state managed by the reducer */
export type AppState = {
  uiState: UIState;
  code: string;
  challengeLanguage: string;
  missionInstructions: string;
  dialogueLog: DialogueEntry[];
  resultMessage: string;
  punishment: string;
  punishmentPhrase: string;
  punishmentRequiredReps: number;
  punishmentProgress: number;
  retryUnlocked: boolean;
  attemptCount: number;
  /** Phone call state */
  callStatus: CallStatus;
  callId: string;
  callError: string;
  phoneNumber: string;
};

/** All possible reducer actions */
export type AppAction =
  | { type: 'BOOT_COMPLETE' }
  | { type: 'BUG_ALERT_COMPLETE' }
  | { type: 'TRAINING_SPLASH_COMPLETE' }
  | { type: 'SUBMIT_CODE' }
  | { type: 'ANALYZE_START' }
  | {
    type: 'RESULT_FAIL';
    message: string;
    punishment?: string;
    punishmentPhrase?: string;
    punishmentReps?: number;
  }
  | { type: 'RESULT_PASS'; message: string }
  | { type: 'SET_CODE'; code: string }
  | { type: 'CHALLENGE_LOADED'; code: string; language: string; instructions: string }
  | { type: 'PUNISHMENT_LINE_COMPLETED' }
  | { type: 'RETRY' }
  | { type: 'NEXT_MISSION' }
  | { type: 'SET_PHONE_NUMBER'; phoneNumber: string }
  | { type: 'CALL_REQUESTED' }
  | { type: 'CALL_INITIATED'; callId: string }
  | { type: 'CALL_IN_PROGRESS' }
  | { type: 'CALL_ENDED' }
  | { type: 'CALL_ERROR'; message: string }
  | { type: 'CALL_DISMISSED' };

/** Messages received from the VS Code extension host */
export type ExtensionMessage =
  | { type: 'ANALYZE_START' }
  | {
    type: 'RESULT_FAIL';
    message: string;
    punishment?: string;
    punishmentPhrase?: string;
    punishmentReps?: number;
  }
  | { type: 'RESULT_PASS'; message: string }
  | { type: 'CHALLENGE_LOADED'; challenge: { language: string; code: string; instructions: string } }
  | { type: 'CALL_REQUESTED' }
  | { type: 'CALL_INITIATED'; callId: string }
  | { type: 'CALL_IN_PROGRESS' }
  | { type: 'CALL_ENDED' }
  | { type: 'CALL_ERROR'; message: string };

/** Persisted panel state for restore after webview close */
export type PersistedPanelState = {
  version: 1;
  appState: AppState;
  timeLeftSec: number;
  savedAt: number;
};
