/* =========================================
 * Sergeant Debugger — useTypewriter Hook
 * =========================================
 * Reveals text character-by-character with an
 * optional audio blip callback per character.
 * ========================================= */

import { useState, useEffect, useRef, useCallback } from 'react';

export interface TypewriterOptions {
    /** Milliseconds between each character (default 30) */
    speed?: number;
    /** Extra pause (ms) after punctuation like . ! ? (default 120) */
    punctuationPause?: number;
    /** Called for each revealed character — use for audio blips */
    onChar?: (char: string, index: number) => void;
    /** Called when the full text has been revealed */
    onComplete?: () => void;
}

const DEFAULTS: Required<Omit<TypewriterOptions, 'onChar' | 'onComplete'>> = {
    speed: 30,
    punctuationPause: 120,
};

const PUNCTUATION = new Set(['.', '!', '?', '…', '—']);

export function useTypewriter(
    fullText: string,
    options: TypewriterOptions = {}
): { displayedText: string; isComplete: boolean; skip: () => void } {
    const { speed, punctuationPause } = { ...DEFAULTS, ...options };
    const onCharRef = useRef(options.onChar);
    const onCompleteRef = useRef(options.onComplete);
    onCharRef.current = options.onChar;
    onCompleteRef.current = options.onComplete;

    const [charIndex, setCharIndex] = useState(0);
    const [isComplete, setIsComplete] = useState(false);

    // Reset when fullText changes
    useEffect(() => {
        setCharIndex(0);
        setIsComplete(false);
    }, [fullText]);

    useEffect(() => {
        if (charIndex >= fullText.length) {
            if (!isComplete) {
                setIsComplete(true);
                onCompleteRef.current?.();
            }
            return;
        }

        const currentChar = fullText[charIndex];
        const delay = PUNCTUATION.has(currentChar) ? speed + punctuationPause : speed;

        const timer = setTimeout(() => {
            setCharIndex((prev) => {
                const next = prev + 1;
                onCharRef.current?.(currentChar, prev);
                return next;
            });
        }, delay);

        return () => clearTimeout(timer);
    }, [charIndex, fullText, speed, punctuationPause, isComplete]);

    const skip = useCallback(() => {
        setCharIndex(fullText.length);
        setIsComplete(true);
        onCompleteRef.current?.();
    }, [fullText]);

    return {
        displayedText: fullText.slice(0, charIndex),
        isComplete,
        skip,
    };
}
