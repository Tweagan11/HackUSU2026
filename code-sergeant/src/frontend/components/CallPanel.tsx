import React, { useState } from 'react';
import type { CallStatus } from '../types';

interface CallPanelProps {
  callStatus: CallStatus;
  callError: string;
  phoneNumber: string;
  onPhoneNumberChange: (phone: string) => void;
  onCallSergeant: () => void;
}

/**
 * Phone call panel — allows the user to enter their phone number
 * and summon the sergeant to call them via Twilio + ElevenLabs.
 *
 * Shows different states:
 *   idle    → phone input + "CALL SERGEANT" button
 *   calling → "Connecting..." indicator
 *   in-progress → "Sergeant is on the line" + pulsing indicator
 *   ended   → "Call ended" message
 *   error   → error message + retry
 */
const CallPanel: React.FC<CallPanelProps> = ({
  callStatus,
  callError,
  phoneNumber,
  onPhoneNumberChange,
  onCallSergeant,
}) => {
  const [inputFocused, setInputFocused] = useState(false);

  const isCallActive = callStatus === 'calling' || callStatus === 'in-progress';
  const canCall = callStatus === 'idle' || callStatus === 'ended' || callStatus === 'error';

  return (
    <div className="call-panel">
      <div className="call-panel__header">📞 COMMS CHANNEL</div>

      {/* Phone number input */}
      <div className={`call-panel__input-group ${inputFocused ? 'call-panel__input-group--focused' : ''}`}>
        <input
          className="call-panel__input"
          type="tel"
          placeholder="+1 (555) 123-4567"
          value={phoneNumber}
          onChange={(e) => onPhoneNumberChange(e.target.value)}
          onFocus={() => setInputFocused(true)}
          onBlur={() => setInputFocused(false)}
          disabled={isCallActive}
          autoComplete="tel"
        />
      </div>

      {/* Call button */}
      <button
        className={`call-panel__button ${isCallActive ? 'call-panel__button--active' : ''}`}
        onClick={onCallSergeant}
        disabled={!canCall || !phoneNumber.trim()}
      >
        {callStatus === 'idle' && '📞 CALL THE SERGEANT'}
        {callStatus === 'calling' && '⏳ CONNECTING...'}
        {callStatus === 'in-progress' && '🔊 SERGEANT ON THE LINE'}
        {callStatus === 'ended' && '📞 CALL AGAIN'}
        {callStatus === 'error' && '📞 RETRY CALL'}
      </button>

      {/* Status indicator */}
      {callStatus === 'calling' && (
        <div className="call-panel__status call-panel__status--calling">
          <span className="call-panel__pulse" />
          Dialing Sergeant Debugger…
        </div>
      )}

      {callStatus === 'in-progress' && (
        <div className="call-panel__status call-panel__status--active">
          <span className="call-panel__pulse call-panel__pulse--green" />
          SERGEANT IS ON THE LINE — ANSWER YOUR PHONE!
        </div>
      )}

      {callStatus === 'ended' && (
        <div className="call-panel__status call-panel__status--ended">
          Call ended. Back to work, recruit.
        </div>
      )}

      {callStatus === 'error' && (
        <div className="call-panel__status call-panel__status--error">
          COMMS ERROR: {callError}
        </div>
      )}
    </div>
  );
};

export default CallPanel;
