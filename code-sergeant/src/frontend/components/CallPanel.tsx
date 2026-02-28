import React, { useState } from 'react';
import type { CallStatus } from '../types';

interface CallPanelProps {
  callStatus: CallStatus;
  callError: string;
  phoneNumber: string;
  onPhoneNumberChange: (phone: string) => void;
  onSubmitNumber: () => void;
  onDismiss: () => void;
}

/**
 * Full-screen call overlay — appears ONLY when the backend decides
 * the sergeant needs to speak to the recruit.
 *
 * Flow:
 *   requested       → "THE SERGEANT NEEDS TO SPEAK TO YOU" + phone input
 *   calling         → "CONNECTING..." with pulsing indicator
 *   in-progress     → "SERGEANT IS ON THE LINE — PICK UP YOUR PHONE!"
 *   ended           → "CALL COMPLETE" + dismiss button
 *   error           → error message + retry / dismiss
 *
 * The overlay blocks all interaction until the call flow resolves.
 */
const CallPanel: React.FC<CallPanelProps> = ({
  callStatus,
  callError,
  phoneNumber,
  onPhoneNumberChange,
  onSubmitNumber,
  onDismiss,
}) => {
  const [inputFocused, setInputFocused] = useState(false);

  // Only render when there's an active call flow
  if (callStatus === 'idle') return null;

  const isCallActive = callStatus === 'calling' || callStatus === 'in-progress';
  const canSubmitNumber = callStatus === 'requested' || callStatus === 'error';

  return (
    <div className="call-overlay">
      <div className="call-overlay__backdrop" />
      <div className="call-overlay__card">

        {/* ── REQUESTED: Sergeant demands to speak ── */}
        {callStatus === 'requested' && (
          <>
            <div className="call-overlay__icon">📞</div>
            <h2 className="call-overlay__title">THE SERGEANT NEEDS TO SPEAK TO YOU</h2>
            <p className="call-overlay__subtitle">
              Your performance has been... <em>noted</em>, recruit.<br />
              Provide your phone number. <strong>NOW.</strong>
            </p>

            <div className={`call-overlay__input-group ${inputFocused ? 'call-overlay__input-group--focused' : ''}`}>
              <input
                className="call-overlay__input"
                type="tel"
                placeholder="+1 (555) 123-4567"
                value={phoneNumber}
                onChange={(e) => onPhoneNumberChange(e.target.value)}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                autoComplete="tel"
                autoFocus
              />
            </div>

            <button
              className="call-overlay__button call-overlay__button--submit"
              onClick={onSubmitNumber}
              disabled={!phoneNumber.trim()}
            >
              ANSWER THE CALL, SOLDIER
            </button>
          </>
        )}

        {/* ── CALLING: Dialing ── */}
        {callStatus === 'calling' && (
          <>
            <div className="call-overlay__icon call-overlay__icon--ringing">📞</div>
            <h2 className="call-overlay__title">STAND BY, RECRUIT</h2>
            <div className="call-overlay__status call-overlay__status--calling">
              <span className="call-overlay__pulse" />
              Dialing Sergeant Debugger…
            </div>
            <p className="call-overlay__subtitle">
              Do NOT leave your post.
            </p>
          </>
        )}

        {/* ── IN-PROGRESS: On the line ── */}
        {callStatus === 'in-progress' && (
          <>
            <div className="call-overlay__icon call-overlay__icon--active">🔊</div>
            <h2 className="call-overlay__title">SERGEANT IS ON THE LINE</h2>
            <div className="call-overlay__status call-overlay__status--active">
              <span className="call-overlay__pulse call-overlay__pulse--green" />
              PICK UP YOUR PHONE, SOLDIER!
            </div>
            <p className="call-overlay__subtitle">
              The sergeant is waiting. Do not keep him waiting.
            </p>
          </>
        )}

        {/* ── ENDED: Call complete ── */}
        {callStatus === 'ended' && (
          <>
            <div className="call-overlay__icon">✅</div>
            <h2 className="call-overlay__title">CALL COMPLETE</h2>
            <p className="call-overlay__subtitle">
              The sergeant has spoken. Now get back to work, recruit.
            </p>
            <button
              className="call-overlay__button call-overlay__button--dismiss"
              onClick={onDismiss}
            >
              YES SIR, BACK TO WORK
            </button>
          </>
        )}

        {/* ── ERROR: Comms failure ── */}
        {callStatus === 'error' && (
          <>
            <div className="call-overlay__icon call-overlay__icon--error">⚠️</div>
            <h2 className="call-overlay__title">COMMS FAILURE</h2>
            <p className="call-overlay__subtitle call-overlay__subtitle--error">
              {callError || 'Unknown communication error.'}
            </p>

            <div className={`call-overlay__input-group ${inputFocused ? 'call-overlay__input-group--focused' : ''}`}>
              <input
                className="call-overlay__input"
                type="tel"
                placeholder="+1 (555) 123-4567"
                value={phoneNumber}
                onChange={(e) => onPhoneNumberChange(e.target.value)}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                autoComplete="tel"
              />
            </div>

            <div className="call-overlay__button-row">
              <button
                className="call-overlay__button call-overlay__button--submit"
                onClick={onSubmitNumber}
                disabled={!phoneNumber.trim()}
              >
                RETRY CALL
              </button>
              <button
                className="call-overlay__button call-overlay__button--dismiss"
                onClick={onDismiss}
              >
                DISMISS
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CallPanel;
