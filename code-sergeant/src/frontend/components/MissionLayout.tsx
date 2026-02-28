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
  punishmentProgress: number;
  showPunishment: boolean;
  onPunishmentLineCompleted: () => void;
  onSubmit: () => void;
  onRetry: () => void;
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
  punishmentProgress,
  showPunishment,
  onPunishmentLineCompleted,
  onSubmit,
  onRetry,
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
          punishmentProgress={punishmentProgress}
          showPunishment={showPunishment}
          onPunishmentLineCompleted={onPunishmentLineCompleted}
          onSubmit={onSubmit}
          onRetry={onRetry}
          onNextMission={onNextMission}
          canRetryAfterPunishment={canRetryAfterPunishment}
        />
      </div>
    </div>
  );
};

export default MissionLayout;
