import React from 'react';

/**
 * Full-screen translucent overlay shown during ANALYZING state.
 * Locks the UI and displays an indeterminate progress bar.
 */
const AnalyzingOverlay: React.FC = () => {
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
