"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const DialogueLog_1 = __importDefault(require("./DialogueLog"));
const PunishmentBox_1 = __importDefault(require("./PunishmentBox"));
const ActionButton_1 = __importDefault(require("./ActionButton"));
/**
 * Sergeant command panel (right 30%).
 * Vertical stack: dialogue log → punishment box → action button.
 * (Phone call overlay is rendered at the App root level.)
 */
const SergeantPanel = ({ uiState, missionInstructions, dialogueLog, punishment, punishmentProgress, showPunishment, onPunishmentLineCompleted, onSubmit, onRetry, onNextMission, canRetryAfterPunishment, }) => {
    return ((0, jsx_runtime_1.jsxs)("div", { className: "sergeant-panel", children: [missionInstructions && ((0, jsx_runtime_1.jsxs)("div", { className: "sergeant-panel__instructions", children: [(0, jsx_runtime_1.jsx)("span", { className: "instructions-label", children: "MISSION OBJECTIVE:" }), (0, jsx_runtime_1.jsx)("p", { className: "instructions-text", children: missionInstructions })] })), (0, jsx_runtime_1.jsx)("div", { className: "sergeant-panel__dialogue", children: (0, jsx_runtime_1.jsx)(DialogueLog_1.default, { entries: dialogueLog }) }), (0, jsx_runtime_1.jsx)("div", { className: "sergeant-panel__punishment", children: (0, jsx_runtime_1.jsx)(PunishmentBox_1.default, { punishment: punishment, visible: showPunishment, progress: punishmentProgress, onLineCompleted: onPunishmentLineCompleted }) }), (0, jsx_runtime_1.jsx)("div", { className: "sergeant-panel__action", children: (0, jsx_runtime_1.jsx)(ActionButton_1.default, { uiState: uiState, onSubmit: onSubmit, onRetry: onRetry, onNextMission: onNextMission, canRetryAfterPunishment: canRetryAfterPunishment }) })] }));
};
exports.default = SergeantPanel;
//# sourceMappingURL=SergeantPanel.js.map