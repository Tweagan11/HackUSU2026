/**
 * Integration tests for the frontend configuration module.
 *
 * Verifies all constants, dialogue arrays, and config values
 * are correctly defined and within expected bounds.
 */

import * as assert from 'assert';
import {
    PUNISHMENT_PHRASE,
    PUNISHMENT_REQUIRED_REPS,
    DIALOGUE,
    BOOT_DURATION_MS,
    BUG_ALERT_DURATION_MS,
    TRAINING_SPLASH_DURATION_MS,
    MISSION_TIMER_SECONDS,
    CSS_VARS,
} from '../frontend/config';

suite('Config — Punishment Constants', () => {
    test('PUNISHMENT_PHRASE is a non-empty string', () => {
        assert.ok(typeof PUNISHMENT_PHRASE === 'string');
        assert.ok(PUNISHMENT_PHRASE.length > 0);
    });

    test('PUNISHMENT_REQUIRED_REPS is a positive integer', () => {
        assert.ok(typeof PUNISHMENT_REQUIRED_REPS === 'number');
        assert.ok(Number.isInteger(PUNISHMENT_REQUIRED_REPS));
        assert.ok(PUNISHMENT_REQUIRED_REPS > 0);
    });
});

suite('Config — Dialogue Arrays', () => {
    const categories = ['idle', 'analyzing', 'fail', 'pass', 'boot', 'briefing', 'alert'] as const;

    for (const category of categories) {
        test(`DIALOGUE.${category} is a non-empty array of strings`, () => {
            const arr = DIALOGUE[category];
            assert.ok(Array.isArray(arr), `DIALOGUE.${category} should be an array`);
            assert.ok(arr.length > 0, `DIALOGUE.${category} should not be empty`);
            for (const item of arr) {
                assert.ok(typeof item === 'string', `Each item in DIALOGUE.${category} should be a string`);
                assert.ok(item.length > 0, `No empty strings in DIALOGUE.${category}`);
            }
        });
    }

    test('DIALOGUE has exactly the expected categories', () => {
        const keys = Object.keys(DIALOGUE).sort();
        const expected = [...categories].sort();
        assert.deepStrictEqual(keys, expected);
    });
});

suite('Config — Timing Constants', () => {
    test('BOOT_DURATION_MS is a positive number', () => {
        assert.ok(typeof BOOT_DURATION_MS === 'number');
        assert.ok(BOOT_DURATION_MS > 0);
    });

    test('BUG_ALERT_DURATION_MS is a positive number', () => {
        assert.ok(typeof BUG_ALERT_DURATION_MS === 'number');
        assert.ok(BUG_ALERT_DURATION_MS > 0);
    });

    test('TRAINING_SPLASH_DURATION_MS is a positive number', () => {
        assert.ok(typeof TRAINING_SPLASH_DURATION_MS === 'number');
        assert.ok(TRAINING_SPLASH_DURATION_MS > 0);
    });

    test('MISSION_TIMER_SECONDS is a positive number', () => {
        assert.ok(typeof MISSION_TIMER_SECONDS === 'number');
        assert.ok(MISSION_TIMER_SECONDS > 0);
    });

    test('timing values are reasonable (not too long for UX)', () => {
        assert.ok(BOOT_DURATION_MS <= 10000, 'Boot should not take > 10s');
        assert.ok(BUG_ALERT_DURATION_MS <= 10000, 'Bug alert should not take > 10s');
        assert.ok(TRAINING_SPLASH_DURATION_MS <= 10000, 'Training splash should not take > 10s');
        assert.ok(MISSION_TIMER_SECONDS <= 600, 'Mission timer should not be > 10 min');
        assert.ok(MISSION_TIMER_SECONDS >= 10, 'Mission timer should be at least 10s');
    });
});

suite('Config — CSS Variables', () => {
    const expectedKeys = ['bg', 'panel', 'grid', 'primary', 'danger', 'warning', 'text', 'muted'];

    test('CSS_VARS has all expected keys', () => {
        for (const key of expectedKeys) {
            assert.ok(
                key in CSS_VARS,
                `CSS_VARS should have key "${key}"`
            );
        }
    });

    test('all CSS_VARS values are valid hex colors', () => {
        const hexPattern = /^#[0-9a-f]{3,8}$/i;
        for (const [key, value] of Object.entries(CSS_VARS)) {
            assert.ok(
                hexPattern.test(value),
                `CSS_VARS.${key} = "${value}" should be a valid hex color`
            );
        }
    });
});
