"use strict";
/* =========================================
 * Sergeant Debugger — Constants & Config
 * =========================================
 * All dialogue lines, punishments, timing,
 * and theme values live here.
 * ========================================= */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CSS_VARS = exports.FAIL_PASS_RATIO = exports.MISSION_TIMER_SECONDS = exports.ANALYZE_MOCK_DELAY_MS = exports.TRAINING_SPLASH_DURATION_MS = exports.BOOT_DURATION_MS = exports.SAMPLE_CODE = exports.DIALOGUE = exports.PUNISHMENT_REQUIRED_REPS = exports.PUNISHMENT_PHRASE = void 0;
/** Mandatory punishment phrase for failed attempts */
exports.PUNISHMENT_PHRASE = 'I WILL DO BETTER';
/** Number of required repetitions before retry is allowed */
exports.PUNISHMENT_REQUIRED_REPS = 10;
/** Dialogue lines by state category */
exports.DIALOGUE = {
    idle: [
        "YOUR MISSION AWAITS.",
        "FIX THE BUG. NO EXCUSES.",
        "I'VE SEEN SPAGHETTI WITH BETTER STRUCTURE.",
        "GET TO WORK, RECRUIT.",
    ],
    analyzing: [
        "RUNNING STATIC ANALYSIS…",
        "PRAYING FOR YOUR STACK TRACE.",
        "CHECKING YOUR PITIFUL ATTEMPT…",
        "THIS BETTER BE GOOD…",
    ],
    fail: [
        "UNACCEPTABLE!",
        "FAILURE IS NOT AN OPTION... BUT YOU FOUND ONE.",
        "BACK TO THE DRAWING BOARD, SOLDIER!",
    ],
    pass: [
        "OUTSTANDING, SOLDIER!",
        "BUG ELIMINATED.",
        "YOU MIGHT JUST MAKE IT AFTER ALL.",
        "MISSION ACCOMPLISHED!",
    ],
    boot: [
        "SYSTEMS ONLINE.",
        "INITIALIZING TACTICAL DEBUGGER…",
        "SERGEANT REPORTING FOR DUTY.",
    ],
};
/** Sample code loaded into the editor on boot */
exports.SAMPLE_CODE = `// MISSION: Fix the null pointer bug
function getUserName(user) {
  // BUG: user might be null!
  return user.name.toUpperCase();
}

// Fix the code above so it handles null values
const result = getUserName(null);
console.log(result);
`;
/** Boot screen duration in milliseconds */
exports.BOOT_DURATION_MS = 2500;
/** Training splash duration in milliseconds */
exports.TRAINING_SPLASH_DURATION_MS = 1200;
/** Mock analyzer delay in milliseconds */
exports.ANALYZE_MOCK_DELAY_MS = 1500;
/** Mission timer duration in seconds */
exports.MISSION_TIMER_SECONDS = 90;
/** Probability of pass in mock mode (0-1) */
exports.FAIL_PASS_RATIO = 0.5;
/** CSS theme variables (also defined in styles.css) */
exports.CSS_VARS = {
    bg: '#0b0f0c',
    panel: '#11161a',
    grid: '#1a2228',
    primary: '#00ff9c',
    danger: '#ff3b3b',
    warning: '#ffcc00',
    text: '#d6ffe9',
    muted: '#6b8f7a',
};
//# sourceMappingURL=config.js.map