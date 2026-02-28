import React, { useEffect } from 'react';
import { DIALOGUE } from '../config';
import { playWarningKlaxon } from '../speechBlip';

/**
 * Boot screen shown during BOOTING state.
 * Mimics a military system initialization sequence.
 * Lines appear one by one with staggered animation.
 * Progress bar fills over the boot duration.
 */
const BootScreen: React.FC = () => {
  // Play military klaxon alarm on mount
  useEffect(() => {
    const cleanup = playWarningKlaxon();
    return cleanup;
  }, []);

  return (
    <div className="boot-screen">
      <div className="boot-screen__title">SERGEANT DEBUGGER</div>
      <div className="boot-screen__subtitle">TACTICAL CODE ANALYSIS UNIT</div>
      <div className="boot-screen__log">
        {DIALOGUE.boot.map((line, i) => (
          <div
            key={i}
            className="boot-screen__line"
            style={{ animationDelay: `${i * 0.6}s` }}
          >
            &gt; {line}
          </div>
        ))}
      </div>
      <div className="boot-screen__progress">
        <div className="boot-screen__progress-bar" />
      </div>
    </div>
  );
};

export default BootScreen;
