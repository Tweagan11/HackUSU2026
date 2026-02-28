"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const CodeEditor_1 = __importDefault(require("./CodeEditor"));
const SergeantPanel_1 = __importDefault(require("./SergeantPanel"));
/**
 * Main split layout:
 *   LEFT  (70%): Monaco code editor
 *   RIGHT (30%): Sergeant command panel
 */
const MissionLayout = ({ code, onCodeChange, readOnly, uiState, dialogueLog, punishment, showPunishment, onSubmit, onRetry, onNextMission, }) => {
    return ((0, jsx_runtime_1.jsxs)("div", { className: "mission-layout", children: [(0, jsx_runtime_1.jsx)("div", { className: "mission-layout__editor", children: (0, jsx_runtime_1.jsx)(CodeEditor_1.default, { value: code, onChange: onCodeChange, readOnly: readOnly }) }), (0, jsx_runtime_1.jsx)("div", { className: "mission-layout__panel", children: (0, jsx_runtime_1.jsx)(SergeantPanel_1.default, { uiState: uiState, dialogueLog: dialogueLog, punishment: punishment, showPunishment: showPunishment, onSubmit: onSubmit, onRetry: onRetry, onNextMission: onNextMission }) })] }));
};
exports.default = MissionLayout;
//# sourceMappingURL=MissionLayout.js.map