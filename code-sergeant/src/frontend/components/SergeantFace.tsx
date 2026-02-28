import React, { useEffect } from 'react';
import type { SergeantMood } from '../types';
import { playAngerRumble } from '../speechBlip';

interface SergeantFaceProps {
  mood: SergeantMood;
}

const MOOD_LABELS: Record<SergeantMood, string> = {
  idle: 'At ease',
  suspicious: 'SUSPICIOUS',
  yelling: 'ANALYZING!',
  angry: 'FURIOUS!',
  disappointed: 'Disappointed',
  proud: 'PROUD!',
};

const SergeantFace: React.FC<SergeantFaceProps> = ({ mood }) => {
  // Play a low rumble when the sergeant enters angry mood
  useEffect(() => {
    if (mood === 'angry') {
      playAngerRumble();
    }
  }, [mood]);

  return (
    <div className={`sergeant-face sergeant-face--${mood}`}>
      <div className="sergeant-face__frame" role="img" aria-label={MOOD_LABELS[mood]}>
        <div className="sergeant-face__portrait">
          <div className="sergeant-face__hat" />
          <div className="sergeant-face__brow" />
          <div className="sergeant-face__eyes">
            <span className="sergeant-face__eye sergeant-face__eye--left" />
            <span className="sergeant-face__eye sergeant-face__eye--right" />
          </div>
          <div className="sergeant-face__nose" />
          <div className="sergeant-face__mouth" />
          <div className="sergeant-face__jaw" />
        </div>
      </div>
      <div className="sergeant-face__label">{MOOD_LABELS[mood]}</div>
    </div>
  );
};

export default SergeantFace;
