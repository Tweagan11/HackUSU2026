import React, { useEffect, useState } from 'react';

interface PunishmentBoxProps {
  punishment: string;
  visible: boolean;
}

/**
 * Flashing red bordered punishment box with typewriter effect.
 * Only visible during RESULT_FAIL state.
 * Shows a random punishment string animated character by character.
 */
const PunishmentBox: React.FC<PunishmentBoxProps> = ({ punishment, visible }) => {
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    if (!visible || !punishment) {
      setDisplayedText('');
      return;
    }

    let index = 0;
    setDisplayedText('');

    const interval = setInterval(() => {
      index++;
      setDisplayedText(punishment.slice(0, index));
      if (index >= punishment.length) {
        clearInterval(interval);
      }
    }, 30);

    return () => clearInterval(interval);
  }, [punishment, visible]);

  if (!visible) return null;

  return (
    <div className="punishment-box">
      <div className="punishment-box__header">⚠ PUNISHMENT ⚠</div>
      <div className="punishment-box__text">{displayedText}</div>
    </div>
  );
};

export default PunishmentBox;
