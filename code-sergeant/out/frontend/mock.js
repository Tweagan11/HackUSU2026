"use strict";
/* =========================================
 * Sergeant Debugger — Mock Analyzer
 * =========================================
 * Simulates backend analysis for development/testing.
 * On submit, waits ANALYZE_MOCK_DELAY_MS, then randomly
 * dispatches RESULT_PASS or RESULT_FAIL with a sample message.
 *
 * This allows testing all animations and state transitions
 * without a running backend server.
 * ========================================= */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMockAnalyzer = runMockAnalyzer;
const config_1 = require("./config");
const MOCK_FAIL_MESSAGES = [
    'NullPointerException at line 4: user is null',
    'TypeError: Cannot read property "name" of null',
    'Missing null check before property access',
    'Uncaught reference: variable "user" is undefined',
];
const MOCK_PASS_MESSAGES = [
    'All checks passed. Null safety confirmed.',
    'Code compiles clean. No bugs detected.',
    'Static analysis: 0 errors, 0 warnings.',
];
function randomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}
/**
 * Run the mock analyzer.
 * Waits a fixed delay, then dispatches a random PASS or FAIL result.
 * The pass/fail ratio is controlled by FAIL_PASS_RATIO in config.
 */
function runMockAnalyzer(dispatch) {
    setTimeout(() => {
        const passes = Math.random() > config_1.FAIL_PASS_RATIO;
        if (passes) {
            dispatch({
                type: 'RESULT_PASS',
                message: randomItem(MOCK_PASS_MESSAGES),
            });
        }
        else {
            dispatch({
                type: 'RESULT_FAIL',
                message: randomItem(MOCK_FAIL_MESSAGES),
            });
        }
    }, config_1.ANALYZE_MOCK_DELAY_MS);
}
//# sourceMappingURL=mock.js.map