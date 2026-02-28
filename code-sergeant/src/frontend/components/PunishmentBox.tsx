import React, { useEffect, useState } from 'react';
import { PUNISHMENT_PHRASE, PUNISHMENT_REQUIRED_REPS } from '../config';

interface PunishmentBoxProps {
  punishment: string;
  visible: boolean;
  progress: number;
  onLineCompleted: () => void;
}

/**
 * Flashed fail-state punishment box.
 * Only visible during RESULT_FAIL state.
 * Requires writing the punishment phrase a fixed number of times.
 */
const PunishmentBox: React.FC<PunishmentBoxProps> = ({
  punishment,
  visible,
  progress,
  onLineCompleted,
}) => {
  const [displayedText, setDisplayedText] = useState('');
  const [lineInput, setLineInput] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible || !punishment) {
      setDisplayedText('');
      setLineInput('');
      setError('');
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

  const isComplete = progress >= PUNISHMENT_REQUIRED_REPS;

  const submitLine = () => {
    const normalized = lineInput.trim().replace(/\s+/g, ' ');
    if (normalized !== PUNISHMENT_PHRASE) {
      setError(`Type exactly: "${PUNISHMENT_PHRASE}"`);
      return;
    }
    setError('');
    setLineInput('');
    if (!isComplete) {
      onLineCompleted();
    }
  };

  return (
    <div className="punishment-box">
      <div className="punishment-box__header">⚠ PUNISHMENT ⚠</div>
      <div className="punishment-box__text">{displayedText}</div>
      <div className="punishment-box__progress">
        {progress}/{PUNISHMENT_REQUIRED_REPS} completed
      </div>
      {!isComplete && (
        <>
          <input
            className="punishment-box__input"
            type="text"
            value={lineInput}
            onChange={(e) => setLineInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                submitLine();
              }
            }}
            placeholder={PUNISHMENT_PHRASE}
            aria-label="Punishment phrase input"
          />
          <button
            className="punishment-box__submit"
            type="button"
            onClick={submitLine}
          >
            Submit Line
          </button>
        </>
      )}
      {error && <div className="punishment-box__error">{error}</div>}
      {isComplete && (
        <div className="punishment-box__done">
          Punishment complete. Retry is unlocked.
        </div>
      )}
    </div>
  );
};

export default PunishmentBox;
