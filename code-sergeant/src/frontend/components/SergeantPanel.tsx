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
  punishmentProgress: number;
  showPunishment: boolean;
  onPunishmentLineCompleted: () => void;
  onSubmit: () => void;
  onRetry: () => void;
  onNextMission: () => void;
  canRetryAfterPunishment: boolean;
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
  punishmentProgress,
  showPunishment,
  onPunishmentLineCompleted,
  onSubmit,
  onRetry,
  onNextMission,
  canRetryAfterPunishment,
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
        <PunishmentBox
          punishment={punishment}
          visible={showPunishment}
          progress={punishmentProgress}
          onLineCompleted={onPunishmentLineCompleted}
        />
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
          canRetryAfterPunishment={canRetryAfterPunishment}
        />
      </div>
    </div>
  );
};

export default SergeantPanel;
