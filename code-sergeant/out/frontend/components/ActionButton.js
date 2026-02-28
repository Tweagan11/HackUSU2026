"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
/**
 * Context-sensitive action button.
 * Label and behavior change based on current UI state:
 *   IDLE          → "⚔ SUBMIT FIX"
 *   ANALYZING     → "ANALYZING..." (disabled)
 *   RESULT_FAIL   → "↻ TRY AGAIN, RECRUIT"
 *   RESULT_PASS   → "★ NEXT MISSION"
 *   MISSION_COMPLETE → "DISMISSED" (disabled)
 */
const ActionButton = ({ uiState, onSubmit, onRetry, onNextMission, canRetryAfterPunishment, }) => {
    let label = '⚔ SUBMIT FIX';
    let onClick = onSubmit;
    let disabled = false;
    switch (uiState) {
        case 'BOOTING':
            label = 'STANDBY...';
            disabled = true;
            break;
        case 'IDLE':
            label = '⚔ SUBMIT FIX';
            onClick = onSubmit;
            break;
        case 'ANALYZING':
            label = 'ANALYZING...';
            disabled = true;
            break;
        case 'RESULT_FAIL':
            label = canRetryAfterPunishment
                ? '↻ TRY AGAIN, RECRUIT'
                : 'PUNISHMENT IN PROGRESS';
            onClick = onRetry;
            disabled = !canRetryAfterPunishment;
            break;
        case 'RESULT_PASS':
            label = '★ NEXT MISSION';
            onClick = onNextMission;
            break;
        case 'MISSION_COMPLETE':
            label = 'DISMISSED';
            disabled = true;
            break;
    }
    return ((0, jsx_runtime_1.jsx)("button", { className: `action-button action-button--${uiState.toLowerCase()}`, onClick: onClick, disabled: disabled, children: label }));
};
exports.default = ActionButton;
//# sourceMappingURL=ActionButton.js.map