/* =========================================
 * Sergeant Debugger — Main App Component
 * =========================================
 * Orchestrates the UI state machine, effects,
 * message bridge, and renders the full component tree.
 *
 * Component hierarchy:
 *   App
 *   ├── BootScreen
 *   ├── MissionLayout
 *   │   ├── TopBar
 *   │   ├── CodeEditor (Monaco wrapper)
 *   │   └── SergeantPanel
 *   │       ├── DialogueLog
 *   │       ├── PunishmentBox
 *   │       ├── ActionButton
 *   │       └── SergeantFace
 *   ├── AnalyzingOverlay
 *   ├── PassScreen
 *   └── EffectsLayer (shake, flash, confetti)
 * ========================================= */

import React, { useEffect, useReducer, useState, useCallback, useRef } from 'react';
import { appReducer, initialState } from './reducer';
import { createMessageListener, getVSCodeApi, submitCode, triggerTimeout, callSergeant, notifyReady } from './bridge';
import {
  BOOT_DURATION_MS,
  BUG_ALERT_DURATION_MS,
  TRAINING_SPLASH_DURATION_MS,
  MISSION_TIMER_SECONDS,
  PUNISHMENT_REQUIRED_REPS,
  PUNISHMENT_PHRASE,
} from './config';
import type { AppState, PersistedPanelState, UIState, SergeantMood } from './types';

import BootScreen from './components/BootScreen';
import TrainingSplash from './components/TrainingSplash';
import BriefingHold from './components/BriefingHold';
import TopBar from './components/TopBar';
import MissionLayout from './components/MissionLayout';
import AnalyzingOverlay from './components/AnalyzingOverlay';
import PassScreen from './components/PassScreen';
import EffectsLayer from './components/EffectsLayer';
import CallPanel from './components/CallPanel';
import SuspicionAlert from './components/SuspicionAlert';

/** Maps each UI state to the sergeant's mood */
const MOOD_MAP: Record<UIState, SergeantMood> = {
  BOOTING: 'idle',
  BUG_ALERT: 'suspicious',
  BRIEFING_HOLD: 'idle',
  TRAINING_SPLASH: 'idle',
  IDLE: 'idle',
  ANALYZING: 'yelling',
  RESULT_FAIL: 'angry',
  RESULT_PASS: 'proud',
  MISSION_COMPLETE: 'proud',
};

declare global {
  interface Window {
    __CODE_SERGEANT_INITIAL_STATE__?: unknown;
    __CODE_SERGEANT_EDITOR_LANGUAGE__?: unknown;
  }
}

function readEditorLanguage(): string {
  const raw = window.__CODE_SERGEANT_EDITOR_LANGUAGE__;
  return typeof raw === 'string' && raw.trim().length > 0 ? raw : 'plaintext';
}

function isPersistedAppState(value: unknown): value is AppState {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AppState>;
  return (
    typeof candidate.uiState === 'string' &&
    typeof candidate.code === 'string' &&
    Array.isArray(candidate.dialogueLog) &&
    typeof candidate.resultMessage === 'string' &&
    typeof candidate.punishment === 'string' &&
    typeof candidate.punishmentPhrase === 'string' &&
    typeof candidate.punishmentRequiredReps === 'number' &&
    typeof candidate.retryUnlocked === 'boolean' &&
    (typeof candidate.punishmentProgress === 'number' ||
      typeof candidate.punishmentProgress === 'undefined') &&
    typeof candidate.attemptCount === 'number'
  );
}

function readPersistedState(): PersistedPanelState | null {
  const fromWindow = window.__CODE_SERGEANT_INITIAL_STATE__;
  const fromWebviewApi = getVSCodeApi()?.getState();
  const candidate = (fromWindow ?? fromWebviewApi) as Partial<PersistedPanelState> | undefined;
  if (!candidate || typeof candidate !== 'object') return null;
  if (candidate.version !== 1) return null;
  if (!isPersistedAppState(candidate.appState)) return null;
  if (typeof candidate.timeLeftSec !== 'number' || !Number.isFinite(candidate.timeLeftSec)) return null;
  if (typeof candidate.savedAt !== 'number' || !Number.isFinite(candidate.savedAt)) return null;
  return {
    version: 1,
    appState: candidate.appState,
    timeLeftSec: Math.max(0, Math.floor(candidate.timeLeftSec)),
    savedAt: candidate.savedAt,
  };
}

const App: React.FC = () => {
  const persistedState = readPersistedState();
  const editorLanguage = readEditorLanguage();

  const [state, dispatch] = useReducer(appReducer, {
    ...(persistedState?.appState ?? initialState),
    code: persistedState?.appState.code ?? '',
    punishmentProgress: persistedState?.appState.punishmentProgress ?? 0,
    punishmentPhrase: persistedState?.appState.punishmentPhrase ?? PUNISHMENT_PHRASE,
    punishmentRequiredReps:
      persistedState?.appState.punishmentRequiredReps ?? PUNISHMENT_REQUIRED_REPS,
    retryUnlocked: persistedState?.appState.retryUnlocked ?? false,
  });

  const [effects, setEffects] = useState({
    shake: false,
    flash: false,
    confetti: false,
  });
  const [timeLeftSec, setTimeLeftSec] = useState(persistedState?.timeLeftSec ?? MISSION_TIMER_SECONDS);
  const timeoutTriggeredRef = useRef(
    persistedState?.appState.uiState === 'IDLE' && (persistedState.timeLeftSec ?? 0) <= 0
  );
  const previousUiStateRef = useRef(state.uiState);

  // --- Boot sequence: auto-transition to IDLE after delay ---
  useEffect(() => {
    const timer = setTimeout(
      () => dispatch({ type: 'BOOT_COMPLETE' }),
      BOOT_DURATION_MS
    );
    return () => clearTimeout(timer);
  }, []);

  // --- Training splash: transition to coding UI after delay ---
  useEffect(() => {
    if (state.uiState !== 'TRAINING_SPLASH') return;
    const timer = setTimeout(
      () => dispatch({ type: 'TRAINING_SPLASH_COMPLETE' }),
      TRAINING_SPLASH_DURATION_MS
    );
    return () => clearTimeout(timer);
  }, [state.uiState]);

  // --- Suspicion alert: brief cinematic warning before training ---
  useEffect(() => {
    if (state.uiState !== 'BUG_ALERT') return;
    const timer = setTimeout(
      () => dispatch({ type: 'BUG_ALERT_COMPLETE' }),
      BUG_ALERT_DURATION_MS
    );
    return () => clearTimeout(timer);
  }, [state.uiState]);

  // --- Listen for messages from the VS Code extension host ---
  useEffect(() => {
    const cleanup = createMessageListener(dispatch);
    // Tell the extension we're ready to receive data (e.g. challenge)
    notifyReady();
    return cleanup;
  }, []);

  // --- Persist snapshot to webview and extension host for restore after close ---
  useEffect(() => {
    const api = getVSCodeApi();
    if (!api) return;
    const snapshot: PersistedPanelState = {
      version: 1,
      appState: state,
      timeLeftSec,
      savedAt: Date.now(),
    };
    api.setState(snapshot);
    api.postMessage({ type: 'SAVE_STATE', payload: snapshot });
  }, [state, timeLeftSec]);

  // --- Reset timer only when transitioning back into IDLE ---
  useEffect(() => {
    const previousState = previousUiStateRef.current;
    if (previousState !== state.uiState && state.uiState === 'IDLE') {
      setTimeLeftSec(MISSION_TIMER_SECONDS);
      timeoutTriggeredRef.current = false;
    }
    previousUiStateRef.current = state.uiState;
  }, [state.uiState]);

  // --- Mission countdown and timeout trigger ---
  useEffect(() => {
    if (state.uiState !== 'IDLE') return;
    if (timeoutTriggeredRef.current) return;
    if (timeLeftSec <= 0) {
      timeoutTriggeredRef.current = true;
      triggerTimeout();
      return;
    }

    const timer = setTimeout(() => {
      setTimeLeftSec((prev) => Math.max(prev - 1, 0));
    }, 1000);
    return () => clearTimeout(timer);
  }, [state.uiState, timeLeftSec]);

  // --- Trigger visual effects on state transitions ---
  useEffect(() => {
    if (state.uiState === 'RESULT_FAIL') {
      setEffects({ shake: true, flash: true, confetti: false });
      const timer = setTimeout(() => {
        setEffects((prev) => ({ ...prev, shake: false, flash: false }));
      }, 1200);
      return () => clearTimeout(timer);
    }
    if (state.uiState === 'RESULT_PASS') {
      setEffects({ shake: false, flash: false, confetti: true });
    }
    if (state.uiState === 'IDLE' || state.uiState === 'ANALYZING') {
      setEffects({ shake: false, flash: false, confetti: false });
    }
  }, [state.uiState, state.attemptCount]);

  // --- Handlers ---
  const sendCodeForAnalysis = useCallback(() => {
    submitCode(state.code);
  }, [state.code]);

  const handleSubmit = useCallback(() => {
    if (state.uiState !== 'IDLE') return;
    dispatch({ type: 'SUBMIT_CODE' });
    sendCodeForAnalysis();
  }, [state.uiState, sendCodeForAnalysis]);

  const handleResubmit = useCallback(() => {
    if (state.uiState !== 'RESULT_FAIL' || !state.retryUnlocked) return;
    dispatch({ type: 'RETRY' });
    dispatch({ type: 'SUBMIT_CODE' });
    sendCodeForAnalysis();
  }, [state.uiState, state.retryUnlocked, sendCodeForAnalysis]);

  const handlePunishmentLineCompleted = useCallback(() => {
    dispatch({ type: 'PUNISHMENT_LINE_COMPLETED' });
  }, []);

  const handleNextMission = useCallback(() => {
    dispatch({ type: 'NEXT_MISSION' });
  }, []);

  const handleCodeChange = useCallback((code: string) => {
    dispatch({ type: 'SET_CODE', code });
  }, []);

  const handlePhoneNumberChange = useCallback((phoneNumber: string) => {
    dispatch({ type: 'SET_PHONE_NUMBER', phoneNumber });
  }, []);

  /** User submitted their phone number from the call overlay */
  const handleSubmitNumber = useCallback(() => {
    if (!state.phoneNumber.trim()) return;
    callSergeant(state.phoneNumber, {
      bugType: 'unknown bug',
      failCount: state.attemptCount,
      lastError: state.resultMessage,
    });
  }, [state.phoneNumber, state.attemptCount, state.resultMessage]);

  /** Dismiss the call overlay (after call ended or on error) */
  const handleDismissCall = useCallback(() => {
    dispatch({ type: 'CALL_DISMISSED' });
  }, []);

  // --- Derived state ---
  const mood = MOOD_MAP[state.uiState];
  const isEditorReadOnly =
    state.uiState === 'BOOTING' ||
    state.uiState === 'BUG_ALERT' ||
    state.uiState === 'BRIEFING_HOLD' ||
    state.uiState === 'TRAINING_SPLASH' ||
    state.uiState === 'ANALYZING' ||
    state.uiState === 'RESULT_PASS' ||
    state.uiState === 'MISSION_COMPLETE' ||
    (state.uiState === 'RESULT_FAIL' && !state.retryUnlocked);
  // Use the language from the agent's challenge, fall back to editor language
  const resolvedLanguage = state.challengeLanguage || editorLanguage;

  const rootClasses = [
    'app-root',
    effects.shake ? 'effects--shake' : '',
    effects.flash ? 'effects--flash-red' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rootClasses}>
      {/* BOOTING state: show boot screen */}
      {state.uiState === 'BOOTING' && <BootScreen />}
      {state.uiState === 'BUG_ALERT' && <SuspicionAlert />}
      {state.uiState === 'TRAINING_SPLASH' && <TrainingSplash />}
      {state.uiState === 'BRIEFING_HOLD' && <BriefingHold />}

      {/* Main mission UI (hidden during boot + training splash) */}
      {state.uiState !== 'BOOTING' &&
        state.uiState !== 'BUG_ALERT' &&
        state.uiState !== 'TRAINING_SPLASH' &&
        state.uiState !== 'BRIEFING_HOLD' && (
          <>
            <TopBar uiState={state.uiState} mood={mood} timeLeftSec={timeLeftSec} />
            <MissionLayout
              code={state.code}
              onCodeChange={handleCodeChange}
              editorLanguage={resolvedLanguage}
              readOnly={isEditorReadOnly}
              uiState={state.uiState}
              missionInstructions={state.missionInstructions}
              dialogueLog={state.dialogueLog}
              punishment={state.punishment}
              punishmentPhrase={state.punishmentPhrase}
              punishmentRequiredReps={state.punishmentRequiredReps}
              punishmentProgress={state.punishmentProgress}
              showPunishment={state.uiState === 'RESULT_FAIL'}
              onPunishmentLineCompleted={handlePunishmentLineCompleted}
              onSubmit={handleSubmit}
              onResubmit={handleResubmit}
              onNextMission={handleNextMission}
              canRetryAfterPunishment={
                state.uiState === 'RESULT_FAIL' ? state.retryUnlocked : true
              }
            />
          </>
        )}

      {/* ANALYZING overlay: locks UI */}
      {state.uiState === 'ANALYZING' && <AnalyzingOverlay />}

      {/* PASS / MISSION_COMPLETE overlay */}
      {(state.uiState === 'RESULT_PASS' ||
        state.uiState === 'MISSION_COMPLETE') && (
          <PassScreen
            message={state.resultMessage}
            uiState={state.uiState}
            onNextMission={handleNextMission}
          />
        )}

      {/* Confetti particle burst on pass */}
      {effects.confetti && <EffectsLayer type="confetti" />}

      {/* Phone call overlay — blocks UI when the backend requests a call */}
      <CallPanel
        callStatus={state.callStatus}
        callError={state.callError}
        phoneNumber={state.phoneNumber}
        onPhoneNumberChange={handlePhoneNumberChange}
        onSubmitNumber={handleSubmitNumber}
        onDismiss={handleDismissCall}
      />
    </div>
  );
};

export default App;
