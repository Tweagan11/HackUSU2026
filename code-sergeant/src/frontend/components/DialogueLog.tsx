import React, { useEffect, useRef } from 'react';
import type { DialogueEntry } from '../types';

interface DialogueLogProps {
  entries: DialogueEntry[];
}

/**
 * Terminal-style scrolling log.
 * All lines prefixed with SERGEANT:.
 * Persists across attempts.
 * Fail entries get special red styling.
 */
const DialogueLog: React.FC<DialogueLogProps> = ({ entries }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new entries
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries]);

  return (
    <div className="dialogue-log" ref={scrollRef}>
      <div className="dialogue-log__header">/// COMMS LOG ///</div>
      {entries.map((entry, i) => (
        <div
          key={`${entry.timestamp}-${i}`}
          className={`dialogue-log__entry ${entry.type === 'fail' ? 'dialogue-log__entry--fail' : ''}`}
        >
          <span className="dialogue-log__prefix">SERGEANT:</span>{' '}
          <span className="dialogue-log__text">{entry.text}</span>
        </div>
      ))}
      <div className="dialogue-log__cursor">▊</div>
    </div>
  );
};

export default DialogueLog;
