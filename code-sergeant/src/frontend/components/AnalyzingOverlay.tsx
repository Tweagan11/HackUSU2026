import React, { useEffect } from 'react';
import { playSonarPing } from '../speechBlip';

/**
 * Full-screen translucent overlay shown during ANALYZING state.
 * Locks the UI and displays an indeterminate progress bar.
 * Plays a repeating sonar ping while visible.
 */
const AnalyzingOverlay: React.FC = () => {
  // Sonar ping on mount + every 2 seconds while analyzing
  useEffect(() => {
    playSonarPing();
    const interval = setInterval(() => playSonarPing(), 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="analyzing-overlay">
      <div className="analyzing-overlay__text">
        ANALYZING YOUR PITIFUL CODE…
      </div>
      <div className="analyzing-overlay__subtext">
        Stand by for judgment, recruit.
      </div>
      <div className="analyzing-overlay__progress">
        <div className="analyzing-overlay__progress-bar" />
      </div>
    </div>
  );
};

export default AnalyzingOverlay;
