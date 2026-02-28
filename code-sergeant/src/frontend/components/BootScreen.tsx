import React from 'react';
import { DIALOGUE } from '../config';

/**
 * Boot screen shown during BOOTING state.
 * Mimics a military system initialization sequence.
 * Lines appear one by one with staggered animation.
 * Progress bar fills over the boot duration.
 */
const BootScreen: React.FC = () => {
  return (
    <div className="boot-screen">
      <div className="boot-screen__title">SERGEANT DEBUGGER</div>
      <div className="boot-screen__subtitle">TACTICAL CODE ANALYSIS UNIT</div>
      <div className="boot-screen__log">
        {DIALOGUE.boot.map((line, i) => (
          <div
            key={i}
            className="boot-screen__line"
            style={{ animationDelay: `${i * 0.35}s` }}
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
