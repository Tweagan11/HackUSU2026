"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
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
const react_1 = require("react");
const reducer_1 = require("./reducer");
const bridge_1 = require("./bridge");
const mock_1 = require("./mock");
const config_1 = require("./config");
const BootScreen_1 = __importDefault(require("./components/BootScreen"));
const TopBar_1 = __importDefault(require("./components/TopBar"));
const MissionLayout_1 = __importDefault(require("./components/MissionLayout"));
const AnalyzingOverlay_1 = __importDefault(require("./components/AnalyzingOverlay"));
const PassScreen_1 = __importDefault(require("./components/PassScreen"));
const EffectsLayer_1 = __importDefault(require("./components/EffectsLayer"));
/** Maps each UI state to the sergeant's mood */
const MOOD_MAP = {
    BOOTING: 'idle',
    IDLE: 'idle',
    ANALYZING: 'yelling',
    RESULT_FAIL: 'angry',
    RESULT_PASS: 'proud',
    MISSION_COMPLETE: 'proud',
};
function isPersistedAppState(value) {
    if (!value || typeof value !== 'object')
        return false;
    const candidate = value;
    return (typeof candidate.uiState === 'string' &&
        typeof candidate.code === 'string' &&
        Array.isArray(candidate.dialogueLog) &&
        typeof candidate.resultMessage === 'string' &&
        typeof candidate.punishment === 'string' &&
        typeof candidate.attemptCount === 'number');
}
function readPersistedState() {
    const fromWindow = window.__CODE_SERGEANT_INITIAL_STATE__;
    const fromWebviewApi = (0, bridge_1.getVSCodeApi)()?.getState();
    const candidate = (fromWindow ?? fromWebviewApi);
    if (!candidate || typeof candidate !== 'object')
        return null;
    if (candidate.version !== 1)
        return null;
    if (!isPersistedAppState(candidate.appState))
        return null;
    if (candidate.appState.uiState === 'ANALYZING')
        return null;
    if (typeof candidate.timeLeftSec !== 'number' || !Number.isFinite(candidate.timeLeftSec))
        return null;
    if (typeof candidate.savedAt !== 'number' || !Number.isFinite(candidate.savedAt))
        return null;
    return {
        version: 1,
        appState: candidate.appState,
        timeLeftSec: Math.max(0, Math.floor(candidate.timeLeftSec)),
        savedAt: candidate.savedAt,
    };
}
const App = () => {
    const persistedState = readPersistedState();
    const [state, dispatch] = (0, react_1.useReducer)(reducer_1.appReducer, {
        ...(persistedState?.appState ?? reducer_1.initialState),
        code: persistedState?.appState.code ?? config_1.SAMPLE_CODE,
    });
    const [effects, setEffects] = (0, react_1.useState)({
        shake: false,
        flash: false,
        confetti: false,
    });
    const [timeLeftSec, setTimeLeftSec] = (0, react_1.useState)(persistedState?.timeLeftSec ?? config_1.MISSION_TIMER_SECONDS);
    const timeoutTriggeredRef = (0, react_1.useRef)(persistedState?.appState.uiState === 'IDLE' && (persistedState.timeLeftSec ?? 0) <= 0);
    const previousUiStateRef = (0, react_1.useRef)(state.uiState);
    /** True when running outside VS Code webview (standalone browser dev) */
    const isDevMode = !(0, bridge_1.getVSCodeApi)();
    // --- Boot sequence: auto-transition to IDLE after delay ---
    (0, react_1.useEffect)(() => {
        const timer = setTimeout(() => dispatch({ type: 'BOOT_COMPLETE' }), config_1.BOOT_DURATION_MS);
        return () => clearTimeout(timer);
    }, []);
    // --- Listen for messages from the VS Code extension host ---
    (0, react_1.useEffect)(() => (0, bridge_1.createMessageListener)(dispatch), []);
    // --- Persist snapshot to webview and extension host for restore after close ---
    (0, react_1.useEffect)(() => {
        const api = (0, bridge_1.getVSCodeApi)();
        if (!api)
            return;
        const snapshot = {
            version: 1,
            appState: state,
            timeLeftSec,
            savedAt: Date.now(),
        };
        api.setState(snapshot);
        api.postMessage({ type: 'SAVE_STATE', payload: snapshot });
    }, [state, timeLeftSec]);
    // --- Reset timer only when transitioning back into IDLE ---
    (0, react_1.useEffect)(() => {
        const previousState = previousUiStateRef.current;
        if (previousState !== state.uiState && state.uiState === 'IDLE') {
            setTimeLeftSec(config_1.MISSION_TIMER_SECONDS);
            timeoutTriggeredRef.current = false;
        }
        previousUiStateRef.current = state.uiState;
    }, [state.uiState]);
    // --- Mission countdown and timeout trigger ---
    (0, react_1.useEffect)(() => {
        if (state.uiState !== 'IDLE')
            return;
        if (timeoutTriggeredRef.current)
            return;
        if (timeLeftSec <= 0) {
            timeoutTriggeredRef.current = true;
            if (isDevMode) {
                const punishment = config_1.PUNISHMENTS[Math.floor(Math.random() * config_1.PUNISHMENTS.length)];
                dispatch({
                    type: 'RESULT_FAIL',
                    message: 'Time expired. Sergeant initiated punishment protocol.',
                    punishment,
                });
            }
            else {
                (0, bridge_1.triggerTimeout)();
            }
            return;
        }
        const timer = setTimeout(() => {
            setTimeLeftSec((prev) => Math.max(prev - 1, 0));
        }, 1000);
        return () => clearTimeout(timer);
    }, [isDevMode, state.uiState, timeLeftSec]);
    // --- Trigger visual effects on state transitions ---
    (0, react_1.useEffect)(() => {
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
    const handleSubmit = (0, react_1.useCallback)(() => {
        dispatch({ type: 'SUBMIT_CODE' });
        if (isDevMode) {
            // Development mode: simulate backend with mock analyzer
            (0, mock_1.runMockAnalyzer)(dispatch);
        }
        else {
            // Production: send code to extension host → backend
            (0, bridge_1.submitCode)(state.code);
        }
    }, [isDevMode, state.code]);
    const handleRetry = (0, react_1.useCallback)(() => {
        dispatch({ type: 'RETRY' });
    }, []);
    const handleNextMission = (0, react_1.useCallback)(() => {
        dispatch({ type: 'NEXT_MISSION' });
    }, []);
    const handleCodeChange = (0, react_1.useCallback)((code) => {
        dispatch({ type: 'SET_CODE', code });
    }, []);
    const handlePhoneNumberChange = (0, react_1.useCallback)((phoneNumber) => {
        dispatch({ type: 'SET_PHONE_NUMBER', phoneNumber });
    }, []);
    const handleCallSergeant = (0, react_1.useCallback)(() => {
        if (!state.phoneNumber.trim())
            return;
        if (isDevMode) {
            // Simulate call flow in dev mode
            dispatch({ type: 'CALL_INITIATED', callId: 'mock-call-' + Date.now() });
            setTimeout(() => dispatch({ type: 'CALL_IN_PROGRESS' }), 1500);
            setTimeout(() => dispatch({ type: 'CALL_ENDED' }), 8000);
        }
        else {
            // Production: send to extension host → backend POST /call/initiate
            (0, bridge_1.callSergeant)(state.phoneNumber, {
                bugType: 'null pointer',
                failCount: state.attemptCount,
                lastError: state.resultMessage,
            });
        }
    }, [isDevMode, state.phoneNumber, state.attemptCount, state.resultMessage]);
    // --- Derived state ---
    const mood = MOOD_MAP[state.uiState];
    const isEditorReadOnly = state.uiState !== 'IDLE';
    const rootClasses = [
        'app-root',
        effects.shake ? 'effects--shake' : '',
        effects.flash ? 'effects--flash-red' : '',
    ]
        .filter(Boolean)
        .join(' ');
    return ((0, jsx_runtime_1.jsxs)("div", { className: rootClasses, children: [state.uiState === 'BOOTING' && (0, jsx_runtime_1.jsx)(BootScreen_1.default, {}), state.uiState !== 'BOOTING' && ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)(TopBar_1.default, { uiState: state.uiState, mood: mood, timeLeftSec: timeLeftSec }), (0, jsx_runtime_1.jsx)(MissionLayout_1.default, { code: state.code, onCodeChange: handleCodeChange, readOnly: isEditorReadOnly, uiState: state.uiState, dialogueLog: state.dialogueLog, punishment: state.punishment, showPunishment: state.uiState === 'RESULT_FAIL', onSubmit: handleSubmit, onRetry: handleRetry, onNextMission: handleNextMission, callStatus: state.callStatus, callError: state.callError, phoneNumber: state.phoneNumber, onPhoneNumberChange: handlePhoneNumberChange, onCallSergeant: handleCallSergeant })] })), state.uiState === 'ANALYZING' && (0, jsx_runtime_1.jsx)(AnalyzingOverlay_1.default, {}), (state.uiState === 'RESULT_PASS' ||
                state.uiState === 'MISSION_COMPLETE') && ((0, jsx_runtime_1.jsx)(PassScreen_1.default, { message: state.resultMessage, uiState: state.uiState, onNextMission: handleNextMission })), effects.confetti && (0, jsx_runtime_1.jsx)(EffectsLayer_1.default, { type: "confetti" })] }));
};
exports.default = App;
//# sourceMappingURL=App.js.map