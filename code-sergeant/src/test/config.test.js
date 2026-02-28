"use strict";
/**
 * Integration tests for the frontend configuration module.
 *
 * Verifies all constants, dialogue arrays, and config values
 * are correctly defined and within expected bounds.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
const config_1 = require("../frontend/config");
suite('Config — Punishment Constants', () => {
    test('PUNISHMENT_PHRASE is a non-empty string', () => {
        assert.ok(typeof config_1.PUNISHMENT_PHRASE === 'string');
        assert.ok(config_1.PUNISHMENT_PHRASE.length > 0);
    });
    test('PUNISHMENT_REQUIRED_REPS is a positive integer', () => {
        assert.ok(typeof config_1.PUNISHMENT_REQUIRED_REPS === 'number');
        assert.ok(Number.isInteger(config_1.PUNISHMENT_REQUIRED_REPS));
        assert.ok(config_1.PUNISHMENT_REQUIRED_REPS > 0);
    });
});
suite('Config — Dialogue Arrays', () => {
    const categories = ['idle', 'analyzing', 'fail', 'pass', 'boot', 'briefing', 'alert'];
    for (const category of categories) {
        test(`DIALOGUE.${category} is a non-empty array of strings`, () => {
            const arr = config_1.DIALOGUE[category];
            assert.ok(Array.isArray(arr), `DIALOGUE.${category} should be an array`);
            assert.ok(arr.length > 0, `DIALOGUE.${category} should not be empty`);
            for (const item of arr) {
                assert.ok(typeof item === 'string', `Each item in DIALOGUE.${category} should be a string`);
                assert.ok(item.length > 0, `No empty strings in DIALOGUE.${category}`);
            }
        });
    }
    test('DIALOGUE has exactly the expected categories', () => {
        const keys = Object.keys(config_1.DIALOGUE).sort();
        const expected = [...categories].sort();
        assert.deepStrictEqual(keys, expected);
    });
});
suite('Config — Timing Constants', () => {
    test('BOOT_DURATION_MS is a positive number', () => {
        assert.ok(typeof config_1.BOOT_DURATION_MS === 'number');
        assert.ok(config_1.BOOT_DURATION_MS > 0);
    });
    test('BUG_ALERT_DURATION_MS is a positive number', () => {
        assert.ok(typeof config_1.BUG_ALERT_DURATION_MS === 'number');
        assert.ok(config_1.BUG_ALERT_DURATION_MS > 0);
    });
    test('TRAINING_SPLASH_DURATION_MS is a positive number', () => {
        assert.ok(typeof config_1.TRAINING_SPLASH_DURATION_MS === 'number');
        assert.ok(config_1.TRAINING_SPLASH_DURATION_MS > 0);
    });
    test('ANALYZE_MOCK_DELAY_MS is a positive number', () => {
        assert.ok(typeof config_1.ANALYZE_MOCK_DELAY_MS === 'number');
        assert.ok(config_1.ANALYZE_MOCK_DELAY_MS > 0);
    });
    test('MISSION_TIMER_SECONDS is a positive number', () => {
        assert.ok(typeof config_1.MISSION_TIMER_SECONDS === 'number');
        assert.ok(config_1.MISSION_TIMER_SECONDS > 0);
    });
    test('timing values are reasonable (not too long for UX)', () => {
        assert.ok(config_1.BOOT_DURATION_MS <= 10000, 'Boot should not take > 10s');
        assert.ok(config_1.BUG_ALERT_DURATION_MS <= 10000, 'Bug alert should not take > 10s');
        assert.ok(config_1.TRAINING_SPLASH_DURATION_MS <= 10000, 'Training splash should not take > 10s');
        assert.ok(config_1.MISSION_TIMER_SECONDS <= 600, 'Mission timer should not be > 10 min');
        assert.ok(config_1.MISSION_TIMER_SECONDS >= 10, 'Mission timer should be at least 10s');
    });
});
suite('Config — Mock Analyzer', () => {
    test('FAIL_PASS_RATIO is between 0 and 1', () => {
        assert.ok(typeof config_1.FAIL_PASS_RATIO === 'number');
        assert.ok(config_1.FAIL_PASS_RATIO >= 0);
        assert.ok(config_1.FAIL_PASS_RATIO <= 1);
    });
});
suite('Config — CSS Variables', () => {
    const expectedKeys = ['bg', 'panel', 'grid', 'primary', 'danger', 'warning', 'text', 'muted'];
    test('CSS_VARS has all expected keys', () => {
        for (const key of expectedKeys) {
            assert.ok(key in config_1.CSS_VARS, `CSS_VARS should have key "${key}"`);
        }
    });
    test('all CSS_VARS values are valid hex colors', () => {
        const hexPattern = /^#[0-9a-f]{3,8}$/i;
        for (const [key, value] of Object.entries(config_1.CSS_VARS)) {
            assert.ok(hexPattern.test(value), `CSS_VARS.${key} = "${value}" should be a valid hex color`);
        }
    });
});
//# sourceMappingURL=config.test.js.map