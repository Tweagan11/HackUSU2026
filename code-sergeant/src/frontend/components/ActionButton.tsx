import React from 'react';
import type { UIState } from '../types';

interface ActionButtonProps {
  uiState: UIState;
  onSubmit: () => void;
  onResubmit: () => void;
  onNextMission: () => void;
  canRetryAfterPunishment: boolean;
}

/**
 * Context-sensitive action button.
 * Label and behavior change based on current UI state:
 *   IDLE          → "⚔ SUBMIT FIX"
 *   ANALYZING     → "ANALYZING..." (disabled)
 *   RESULT_FAIL   → "↻ TRY AGAIN, RECRUIT"
 *   RESULT_PASS   → "★ NEXT MISSION"
 *   MISSION_COMPLETE → "DISMISSED" (disabled)
 */
const ActionButton: React.FC<ActionButtonProps> = ({
  uiState,
  onSubmit,
  onResubmit,
  onNextMission,
  canRetryAfterPunishment,
}) => {
  let label = '⚔ SUBMIT FIX';
  let onClick = onSubmit;
  let disabled = false;

  switch (uiState) {
    case 'BOOTING':
      label = 'STANDBY...';
      disabled = true;
      break;
    case 'BUG_ALERT':
      label = 'SCANNING FOR BUGS';
      disabled = true;
      break;
    case 'BRIEFING_HOLD':
      label = 'AWAITING ORDERS';
      disabled = true;
      break;
    case 'IDLE':
      label = '⚔ SUBMIT FIX';
      onClick = onSubmit;
      break;
    case 'ANALYZING':
      label = 'ANALYZING...';
      disabled = true;
      break;
    case 'RESULT_FAIL':
      label = canRetryAfterPunishment
        ? '↻ RESUBMIT FIX'
        : 'PUNISHMENT IN PROGRESS';
      onClick = onResubmit;
      disabled = !canRetryAfterPunishment;
      break;
    case 'RESULT_PASS':
      label = '★ NEXT MISSION';
      onClick = onNextMission;
      break;
    case 'MISSION_COMPLETE':
      label = 'DISMISSED';
      disabled = true;
      break;
  }

  return (
    <button
      className={`action-button action-button--${uiState.toLowerCase()}`}
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  );
};

export default ActionButton;
