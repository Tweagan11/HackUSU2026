import React from 'react';
import type { SergeantMood } from '../types';

// image imports for each mood; webpack will copy these into the final media bundle
import idleImg from '../assets/sergeant-idle.png';
import suspiciousImg from '../assets/sergeant-suspicious.png';
import yellingImg from '../assets/sergeant-yelling.png';
import angryImg from '../assets/sergeant-angry.png';
import disappointedImg from '../assets/sergeant-disappointed.png';
import proudImg from '../assets/sergeant-proud.png';

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

const MOOD_IMAGES: Record<SergeantMood, string> = {
  idle: idleImg,
  suspicious: suspiciousImg,
  yelling: yellingImg,
  angry: angryImg,
  disappointed: disappointedImg,
  proud: proudImg,
};

const SergeantFace: React.FC<SergeantFaceProps> = ({ mood }) => {
  return (
    <div className={`sergeant-face sergeant-face--${mood}`}>      
      <img
        className="sergeant-face__image"
        src={MOOD_IMAGES[mood]}
        alt={MOOD_LABELS[mood]}
      />
      <div className="sergeant-face__label">{MOOD_LABELS[mood]}</div>
    </div>
  );
};

export default SergeantFace;
