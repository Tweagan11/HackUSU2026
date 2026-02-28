import React, { useEffect, useRef, useCallback } from 'react';
import type { DialogueEntry } from '../types';
import { useTypewriter } from '../useTypewriter';
import { playBlip, BLIP_PRESETS } from '../speechBlip';

interface DialogueLogProps {
  entries: DialogueEntry[];
}

/* ── Typewriter wrapper for the newest entry ── */
const TypewriterEntry: React.FC<{ entry: DialogueEntry; onComplete?: () => void }> = ({
  entry,
  onComplete,
}) => {
  const blipOpts = entry.type === 'fail' ? BLIP_PRESETS.angry : BLIP_PRESETS.sergeant;

  const handleChar = useCallback(
    (char: string) => playBlip(char, blipOpts),
    [entry.type],
  );

  const { displayedText, isComplete, skip } = useTypewriter(entry.text, {
    speed: 30,
    punctuationPause: 120,
    onChar: handleChar,
    onComplete,
  });

  return (
    <div
      className={`dialogue-log__entry ${entry.type === 'fail' ? 'dialogue-log__entry--fail' : ''}`}
      onClick={skip}
      title={isComplete ? undefined : 'Click to skip'}
    >
      <span className="dialogue-log__prefix">SERGEANT:</span>{' '}
      <span className="dialogue-log__text">
        {displayedText}
        {!isComplete && <span className="dialogue-log__typing-cursor">▌</span>}
      </span>
    </div>
  );
};

/**
 * Terminal-style scrolling log.
 * All lines prefixed with SERGEANT:.
 * Persists across attempts.
 * Fail entries get special red styling.
 *
 * The newest entry uses a character-by-character typewriter
 * reveal with retro speech blip audio. Older entries display
 * their full text immediately.
 */
const DialogueLog: React.FC<DialogueLogProps> = ({ entries }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new entries and during typewriter reveal
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [entries, scrollToBottom]);

  // Also scroll during typewriter animation via MutationObserver
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const observer = new MutationObserver(scrollToBottom);
    observer.observe(el, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [scrollToBottom]);

  return (
    <div className="dialogue-log" ref={scrollRef}>
      <div className="dialogue-log__header">/// COMMS LOG ///</div>

      {/* Older entries — fully revealed, no animation */}
      {entries.slice(0, -1).map((entry, i) => (
        <div
          key={`${entry.timestamp}-${i}`}
          className={`dialogue-log__entry ${entry.type === 'fail' ? 'dialogue-log__entry--fail' : ''}`}
        >
          <span className="dialogue-log__prefix">SERGEANT:</span>{' '}
          <span className="dialogue-log__text">{entry.text}</span>
        </div>
      ))}

      {/* Newest entry — typewriter + speech blips */}
      {entries.length > 0 && (
        <TypewriterEntry
          key={`tw-${entries[entries.length - 1].timestamp}-${entries.length}`}
          entry={entries[entries.length - 1]}
          onComplete={scrollToBottom}
        />
      )}

      <div className="dialogue-log__cursor">▊</div>
    </div>
  );
};

export default DialogueLog;
