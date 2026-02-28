import React, { useEffect, useState } from 'react';

interface PunishmentBoxProps {
  punishment: string;
  visible: boolean;
  phrase: string;
  requiredReps: number;
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
  phrase,
  requiredReps,
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

  const totalReps = Math.max(0, requiredReps);
  // If the LLM didn't assign write-lines (reps === 0), don't render the box at all
  if (totalReps === 0) return null;

  const isComplete = progress >= totalReps;

  const normalize = (value: string) => value.trim().replace(/\s+/g, ' ').toUpperCase();

  const submitLine = () => {
    const normalizedInput = normalize(lineInput);
    if (!normalizedInput.length) {
      setError('Type the punishment phrase before submitting.');
      return;
    }
    if (normalizedInput !== normalize(phrase)) {
      setError(`Type exactly: "${phrase}"`);
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
        {totalReps > 0
          ? `${Math.min(progress, totalReps)}/${totalReps} completed`
          : 'No punishment required'}
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
            placeholder={phrase}
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
