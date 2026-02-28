/* =========================================
 * Sergeant Debugger — Retro Speech Blip Audio
 * =========================================
 * Generates short oscillator "blips" per character,
 * similar to Undertale / Animal Crossing speech.
 *
 * Uses the Web Audio API — no external audio files needed.
 * Each character triggers a brief square-wave tone at a
 * base frequency, with slight random pitch variation to
 * mimic natural speech cadence.
 * ========================================= */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioCtx;
}

export interface BlipOptions {
    /** Base frequency in Hz (default 220 — "gruff sergeant" pitch) */
    baseFrequency?: number;
    /** Random pitch variation range in Hz (default ±30) */
    pitchVariation?: number;
    /** Duration of each blip in seconds (default 0.06) */
    duration?: number;
    /** Volume 0–1 (default 0.15) */
    volume?: number;
    /** Oscillator waveform (default 'square' for retro feel) */
    waveform?: OscillatorType;
}

const DEFAULTS: Required<BlipOptions> = {
    baseFrequency: 220,
    pitchVariation: 30,
    duration: 0.06,
    volume: 0.15,
    waveform: 'square',
};

/**
 * Play a single retro speech blip.
 * Skips silently for whitespace / punctuation pauses.
 */
export function playBlip(char: string, opts: BlipOptions = {}): void {
    // Don't blip on spaces or punctuation — creates natural pauses
    if (/\s/.test(char)) return;

    const {
        baseFrequency,
        pitchVariation,
        duration,
        volume,
        waveform,
    } = { ...DEFAULTS, ...opts };

    try {
        const ctx = getAudioContext();

        // Resume context if suspended (required by autoplay policies)
        if (ctx.state === 'suspended') {
            ctx.resume();
        }

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        // Slight random pitch wobble for natural feel
        const freqOffset = (Math.random() - 0.5) * 2 * pitchVariation;
        osc.type = waveform;
        osc.frequency.setValueAtTime(baseFrequency + freqOffset, ctx.currentTime);

        // Quick attack, quick release to keep it clicky
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.005);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + duration + 0.01);
    } catch {
        // Silently swallow — audio is non-critical
    }
}

/**
 * Preset blip configs for different moods.
 */
export const BLIP_PRESETS = {
    /** Default sergeant voice — low gruff square wave */
    sergeant: {
        baseFrequency: 220,
        pitchVariation: 30,
        duration: 0.06,
        volume: 0.15,
        waveform: 'square' as OscillatorType,
    },
    /** Angry / fail state — lower pitch, louder */
    angry: {
        baseFrequency: 160,
        pitchVariation: 20,
        duration: 0.07,
        volume: 0.2,
        waveform: 'sawtooth' as OscillatorType,
    },
    /** Pass / proud — higher pitch, softer */
    proud: {
        baseFrequency: 330,
        pitchVariation: 40,
        duration: 0.05,
        volume: 0.12,
        waveform: 'square' as OscillatorType,
    },
} as const;

/* =========================================
 * Sound Effects — Non-speech audio cues
 * ========================================= */

/**
 * Military-style warning klaxon for the boot screen.
 * Three alternating square-wave alarm tones.
 * Returns a cleanup function to disconnect nodes early.
 */
export function playWarningKlaxon(): () => void {
    try {
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') ctx.resume();

        const now = ctx.currentTime;
        const nodes: AudioNode[] = [];

        for (let i = 0; i < 3; i++) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'square';
            const start = now + i * 0.35;
            osc.frequency.setValueAtTime(i % 2 === 0 ? 440 : 330, start);

            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(0.1, start + 0.02);
            gain.gain.linearRampToValueAtTime(0.1, start + 0.15);
            gain.gain.linearRampToValueAtTime(0, start + 0.28);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(start);
            osc.stop(start + 0.3);
            nodes.push(osc, gain);
        }

        return () => {
            nodes.forEach((n) => { try { n.disconnect(); } catch { /* noop */ } });
        };
    } catch {
        return () => { };
    }
}

/**
 * Sonar ping — classic submarine-style sweep + decay.
 * Plays once per call; callers can repeat on an interval.
 */
export function playSonarPing(): void {
    try {
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') ctx.resume();

        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        // Quick upward sweep for the "ping"
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(1400, now + 0.08);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.5);

        // Sharp attack → long exponential decay
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.09, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.85);
    } catch {
        // Audio is non-critical
    }
}

/**
 * Low angry rumble/buzz when the sergeant is furious.
 * Sawtooth growl with rapid LFO tremolo.
 */
export function playAngerRumble(): void {
    try {
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') ctx.resume();

        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        const masterGain = ctx.createGain();

        // Low sawtooth growl descending in pitch
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(80, now);
        osc.frequency.linearRampToValueAtTime(55, now + 0.6);

        // Rapid LFO for buzzy tremolo
        lfo.type = 'square';
        lfo.frequency.setValueAtTime(20, now);
        lfoGain.gain.setValueAtTime(0.08, now);

        lfo.connect(lfoGain);
        lfoGain.connect(masterGain.gain);

        masterGain.gain.setValueAtTime(0.12, now);
        masterGain.gain.linearRampToValueAtTime(0, now + 0.6);

        osc.connect(masterGain);
        masterGain.connect(ctx.destination);

        osc.start(now);
        lfo.start(now);
        osc.stop(now + 0.65);
        lfo.stop(now + 0.65);
    } catch {
        // Audio is non-critical
    }
}
