import React from 'react';
import type { UIState, CallStatus, DialogueEntry } from '../types';
import CodeEditor from './CodeEditor';
import SergeantPanel from './SergeantPanel';

interface MissionLayoutProps {
  code: string;
  onCodeChange: (code: string) => void;
  readOnly: boolean;
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
 * Main split layout:
 *   LEFT  (70%): Monaco code editor
 *   RIGHT (30%): Sergeant command panel
 */
const MissionLayout: React.FC<MissionLayoutProps> = ({
  code,
  onCodeChange,
  readOnly,
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
    <div className="mission-layout">
      <div className="mission-layout__editor">
        <CodeEditor value={code} onChange={onCodeChange} readOnly={readOnly} />
      </div>
      <div className="mission-layout__panel">
        <SergeantPanel
          uiState={uiState}
          dialogueLog={dialogueLog}
          punishment={punishment}
          showPunishment={showPunishment}
          onSubmit={onSubmit}
          onRetry={onRetry}
          onNextMission={onNextMission}
          callStatus={callStatus}
          callError={callError}
          phoneNumber={phoneNumber}
          onPhoneNumberChange={onPhoneNumberChange}
          onCallSergeant={onCallSergeant}
        />
      </div>
    </div>
  );
};

export default MissionLayout;
