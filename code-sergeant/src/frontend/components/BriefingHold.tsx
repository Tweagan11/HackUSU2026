import React from 'react';

/** Screen that holds the user until the backend delivers a challenge. */
const BriefingHold: React.FC = () => {
  return (
    <div className="briefing-hold" role="status" aria-live="polite">
      <div className="briefing-hold__radar">
        <div className="briefing-hold__radar-line" />
        <div className="briefing-hold__radar-pulse" />
      </div>
      <div className="briefing-hold__title">Awaiting Mission Briefing…</div>
      <p className="briefing-hold__text">
        The Sergeant is scanning your workspace for the next objective. Stand by while intel is compiled.
      </p>
    </div>
  );
};

export default BriefingHold;
