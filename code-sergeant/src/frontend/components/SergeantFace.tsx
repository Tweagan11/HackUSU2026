import React, { useEffect } from 'react';
import type { SergeantMood } from '../types';
import { playAngerRumble } from '../speechBlip';

interface SergeantFaceProps {
  mood: SergeantMood;
}

/** Moods where the sergeant is "speaking" — mouth toggles open/closed */
const SPEAKING_MOODS: SergeantMood[] = ['yelling', 'suspicious'];
/** Moods where the sergeant is angry — fuming sprite */
const ANGRY_MOODS: SergeantMood[] = ['angry', 'disappointed'];

const SPEAK_INTERVAL_MS = 280; // mouth toggle speed

const SergeantFace: React.FC<SergeantFaceProps> = ({ mood }) => {
  // Play a low rumble when the sergeant enters angry mood
  useEffect(() => {
    if (mood === 'angry') {
      playAngerRumble();
    }
  }, [mood]);

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
