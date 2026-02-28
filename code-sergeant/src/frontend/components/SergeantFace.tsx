import React, { useEffect, useState } from 'react';
import type { SergeantMood } from '../types';
import sergeantOpen from '../assets/sergeant_open.png';
import sergeantClosed from '../assets/sergeant_closed.png';
import sergeantFuming from '../assets/sergeant_fuming.png';

interface SergeantFaceProps {
  mood: SergeantMood;
}

/** Moods where the sergeant is "speaking" — mouth toggles open/closed */
const SPEAKING_MOODS: SergeantMood[] = ['yelling', 'suspicious'];
/** Moods where the sergeant is angry — fuming sprite */
const ANGRY_MOODS: SergeantMood[] = ['angry', 'disappointed'];

const SPEAK_INTERVAL_MS = 280; // mouth toggle speed

const SergeantFace: React.FC<SergeantFaceProps> = ({ mood }) => {
  const [mouthOpen, setMouthOpen] = useState(false);

  // Animate mouth open/closed while speaking
  useEffect(() => {
    if (!SPEAKING_MOODS.includes(mood)) {
      setMouthOpen(false);
      return;
    }
    const interval = setInterval(() => {
      setMouthOpen((prev) => !prev);
    }, SPEAK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [mood]);

  let src: string;
  if (ANGRY_MOODS.includes(mood)) {
    src = sergeantFuming;
  } else if (SPEAKING_MOODS.includes(mood)) {
    src = mouthOpen ? sergeantOpen : sergeantClosed;
  } else {
    // idle, proud — resting face (mouth closed)
    src = sergeantClosed;
  }

  return (
    <img
      className="sergeant-face__image"
      src={src}
      alt="Sergeant"
      style={{ width: '192px', height: '192px', imageRendering: 'pixelated' }}
    />
  );
};

export default SergeantFace;
