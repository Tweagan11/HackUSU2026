import React, { useEffect, useState } from 'react';

interface EffectsLayerProps {
  type: 'confetti';
}

const CONFETTI_COLORS = ['#00ff9c', '#ffcc00', '#ff3b3b', '#00aaff', '#ff66ff', '#ffffff'];
const CONFETTI_COUNT = 40;

interface ConfettiPiece {
  id: number;
  left: string;
  color: string;
  delay: string;
  size: number;
}

/**
 * Visual effects layer for screen-wide animations.
 * Currently supports pixel confetti burst on PASS.
 * Positioned fixed, pointer-events: none.
 */
const EffectsLayer: React.FC<EffectsLayerProps> = ({ type }) => {
  const [particles, setParticles] = useState<ConfettiPiece[]>([]);

  useEffect(() => {
    if (type === 'confetti') {
      const pieces: ConfettiPiece[] = Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
        id: i,
        left: `${Math.random() * 100}%`,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        delay: `${Math.random() * 1}s`,
        size: 4 + Math.random() * 8,
      }));
      setParticles(pieces);
    }
  }, [type]);

  if (type === 'confetti') {
    return (
      <div className="confetti-container">
        {particles.map((p) => (
          <div
            key={p.id}
            className="confetti-piece"
            style={{
              left: p.left,
              backgroundColor: p.color,
              animationDelay: p.delay,
              width: p.size,
              height: p.size,
            }}
          />
        ))}
      </div>
    );
  }

  return null;
};

export default EffectsLayer;
