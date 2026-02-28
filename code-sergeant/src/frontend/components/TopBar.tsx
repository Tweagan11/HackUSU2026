import React from 'react';
import type { UIState, SergeantMood } from '../types';
import SergeantFace from './SergeantFace';

interface TopBarProps {
  uiState: UIState;
  mood: SergeantMood;
  timeLeftSec: number;
}

/**
 * Top command bar:
 *   Left:   Mission name
 *   Center: Mission timer with blinking cursor
 *   Right:  Sergeant face sprite
 */
const TopBar: React.FC<TopBarProps> = ({ mood, timeLeftSec }) => {
  const minutes = Math.floor(timeLeftSec / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (timeLeftSec % 60).toString().padStart(2, '0');

  return (
    <div className="top-bar">
      <div className="top-bar__mission">
        MISSION: FIX THE NULL POINTER
      </div>
      <div className="top-bar__status">
        TIMER: {minutes}:{seconds}
        <span className="top-bar__cursor">▊</span>
      </div>
      <SergeantFace mood={mood} />
    </div>
  );
};

export default TopBar;
