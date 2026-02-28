import React from 'react';
import type { UIState, CallStatus, DialogueEntry } from '../types';
import DialogueLog from './DialogueLog';
import PunishmentBox from './PunishmentBox';
import ActionButton from './ActionButton';
import CallPanel from './CallPanel';

interface SergeantPanelProps {
  uiState: UIState;
  dialogueLog: DialogueEntry[];
  punishment: string;
  showPunishment: boolean;
  onSubmit: () => void;
  onRetry: () => void;
  onNextMission: () => void;
  /** Phone call props */
  callStatus: CallStatus;
  callError: string;
  phoneNumber: string;
  onPhoneNumberChange: (phone: string) => void;
  onCallSergeant: () => void;
}

/**
 * Sergeant command panel (right 30%).
 * Vertical stack: dialogue log → punishment box → call panel → action button.
 */
const SergeantPanel: React.FC<SergeantPanelProps> = ({
  uiState,
  dialogueLog,
  punishment,
  showPunishment,
  onSubmit,
  onRetry,
  onNextMission,
  callStatus,
  callError,
  phoneNumber,
  onPhoneNumberChange,
  onCallSergeant,
}) => {
  return (
    <div className="sergeant-panel">
      <div className="sergeant-panel__dialogue">
        <DialogueLog entries={dialogueLog} />
      </div>
      <div className="sergeant-panel__punishment">
        <PunishmentBox punishment={punishment} visible={showPunishment} />
      </div>
      <div className="sergeant-panel__call">
        <CallPanel
          callStatus={callStatus}
          callError={callError}
          phoneNumber={phoneNumber}
          onPhoneNumberChange={onPhoneNumberChange}
          onCallSergeant={onCallSergeant}
        />
      </div>
      <div className="sergeant-panel__action">
        <ActionButton
          uiState={uiState}
          onSubmit={onSubmit}
          onRetry={onRetry}
          onNextMission={onNextMission}
        />
      </div>
    </div>
  );
};

export default SergeantPanel;
