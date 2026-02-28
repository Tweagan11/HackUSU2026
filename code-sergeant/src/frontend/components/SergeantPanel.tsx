import React from 'react';
import type { UIState, DialogueEntry } from '../types';
import DialogueLog from './DialogueLog';
import PunishmentBox from './PunishmentBox';
import ActionButton from './ActionButton';

interface SergeantPanelProps {
  uiState: UIState;
  dialogueLog: DialogueEntry[];
  punishment: string;
  showPunishment: boolean;
  onSubmit: () => void;
  onRetry: () => void;
  onNextMission: () => void;
}

/**
 * Sergeant command panel (right 30%).
 * Vertical stack: dialogue log → punishment box → action button.
 * (Phone call overlay is rendered at the App root level.)
 */
const SergeantPanel: React.FC<SergeantPanelProps> = ({
  uiState,
  dialogueLog,
  punishment,
  showPunishment,
  onSubmit,
  onRetry,
  onNextMission,
}) => {
  return (
    <div className="sergeant-panel">
      <div className="sergeant-panel__dialogue">
        <DialogueLog entries={dialogueLog} />
      </div>
      <div className="sergeant-panel__punishment">
        <PunishmentBox punishment={punishment} visible={showPunishment} />
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
