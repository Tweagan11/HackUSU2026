import React from 'react';
import type { UIState, DialogueEntry } from '../types';
import DialogueLog from './DialogueLog';
import PunishmentBox from './PunishmentBox';
import ActionButton from './ActionButton';

interface SergeantPanelProps {
  uiState: UIState;
  missionInstructions: string;
  dialogueLog: DialogueEntry[];
  punishment: string;
  punishmentPhrase: string;
  punishmentRequiredReps: number;
  punishmentProgress: number;
  showPunishment: boolean;
  onPunishmentLineCompleted: () => void;
  onSubmit: () => void;
  onResubmit: () => void;
  onNextMission: () => void;
  canRetryAfterPunishment: boolean;
}

/**
 * Sergeant command panel (right 30%).
 * Vertical stack: dialogue log → punishment box → action button.
 * (Phone call overlay is rendered at the App root level.)
 */
const SergeantPanel: React.FC<SergeantPanelProps> = ({
  uiState,
  missionInstructions,
  dialogueLog,
  punishment,
  punishmentPhrase,
  punishmentRequiredReps,
  punishmentProgress,
  showPunishment,
  onPunishmentLineCompleted,
  onSubmit,
  onResubmit,
  onNextMission,
  canRetryAfterPunishment,
}) => {
  return (
    <div className="sergeant-panel">
      {missionInstructions && (
        <div className="sergeant-panel__instructions">
          <span className="instructions-label">MISSION OBJECTIVE:</span>
          <p className="instructions-text">{missionInstructions}</p>
        </div>
      )}
      <div className="sergeant-panel__dialogue">
        <DialogueLog entries={dialogueLog} />
      </div>
      <div className="sergeant-panel__punishment">
        <PunishmentBox
          punishment={punishment}
          visible={showPunishment}
          phrase={punishmentPhrase}
          requiredReps={punishmentRequiredReps}
          progress={punishmentProgress}
          onLineCompleted={onPunishmentLineCompleted}
        />
      </div>
      <div className="sergeant-panel__action">
        <ActionButton
          uiState={uiState}
          onSubmit={onSubmit}
          onResubmit={onResubmit}
          onNextMission={onNextMission}
          canRetryAfterPunishment={canRetryAfterPunishment}
        />
      </div>
    </div>
  );
};

export default SergeantPanel;
