import React from 'react';
import type { UIState, DialogueEntry } from '../types';
import CodeEditor from './CodeEditor';
import SergeantPanel from './SergeantPanel';

interface MissionLayoutProps {
  code: string;
  onCodeChange: (code: string) => void;
  editorLanguage: string;
  readOnly: boolean;
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
 * Main split layout:
 *   LEFT  (70%): Monaco code editor
 *   RIGHT (30%): Sergeant command panel
 */
const MissionLayout: React.FC<MissionLayoutProps> = ({
  code,
  onCodeChange,
  editorLanguage,
  readOnly,
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
    <div className="mission-layout">
      <div className="mission-layout__editor">
        <CodeEditor
          value={code}
          onChange={onCodeChange}
          language={editorLanguage}
          readOnly={readOnly}
        />
      </div>
      <div className="mission-layout__panel">
        <SergeantPanel
          uiState={uiState}
          missionInstructions={missionInstructions}
          dialogueLog={dialogueLog}
          punishment={punishment}
          punishmentPhrase={punishmentPhrase}
          punishmentRequiredReps={punishmentRequiredReps}
          punishmentProgress={punishmentProgress}
          showPunishment={showPunishment}
          onPunishmentLineCompleted={onPunishmentLineCompleted}
          onSubmit={onSubmit}
          onResubmit={onResubmit}
          onNextMission={onNextMission}
          canRetryAfterPunishment={canRetryAfterPunishment}
        />
      </div>
    </div>
  );
};

export default MissionLayout;
