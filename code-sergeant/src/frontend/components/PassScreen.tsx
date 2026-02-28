import React from 'react';
import type { UIState } from '../types';
import ActionButton from './ActionButton';
import { dismissPanel } from '../bridge';

interface PassScreenProps {
  message: string;
  uiState: UIState;
  onNextMission: () => void;
}

/**
 * Full-screen mission complete overlay.
 * Shows medal drop animation, proud sergeant text,
 * and a "NEXT MISSION" action button.
 * Displayed on RESULT_PASS and MISSION_COMPLETE states.
 */
const PassScreen: React.FC<PassScreenProps> = ({ message, uiState, onNextMission }) => {
  return (
    <div className="pass-screen">
      <div className="pass-screen__medal">🎖️</div>
      <div className="pass-screen__title">MISSION ACCOMPLISHED</div>
      <div className="pass-screen__message">{message}</div>
      <div className="pass-screen__sergeant">
        — SGT. DEBUGGER salutes you.
      </div>
      <div className="pass-screen__action">
        <ActionButton
          uiState={uiState}
          onSubmit={() => { }}
          onResubmit={() => { }}
          onNextMission={onNextMission}
          canRetryAfterPunishment={true}
        />
        {uiState === 'MISSION_COMPLETE' && (
          <button
            className="action-button action-button--dismiss"
            onClick={dismissPanel}
            style={{ marginTop: '1rem' }}
          >
            🚪 FALL OUT, SOLDIER
          </button>
        )}
      </div>
    </div>
  );
};

export default PassScreen;
