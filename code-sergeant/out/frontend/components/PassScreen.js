"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const ActionButton_1 = __importDefault(require("./ActionButton"));
/**
 * Full-screen mission complete overlay.
 * Shows medal drop animation, proud sergeant text,
 * and a "NEXT MISSION" action button.
 * Displayed on RESULT_PASS and MISSION_COMPLETE states.
 */
const PassScreen = ({ message, uiState, onNextMission }) => {
    return ((0, jsx_runtime_1.jsxs)("div", { className: "pass-screen", children: [(0, jsx_runtime_1.jsx)("div", { className: "pass-screen__medal", children: "\uD83C\uDF96\uFE0F" }), (0, jsx_runtime_1.jsx)("div", { className: "pass-screen__title", children: "MISSION ACCOMPLISHED" }), (0, jsx_runtime_1.jsx)("div", { className: "pass-screen__message", children: message }), (0, jsx_runtime_1.jsx)("div", { className: "pass-screen__sergeant", children: "\u2014 SGT. DEBUGGER salutes you." }), (0, jsx_runtime_1.jsx)("div", { className: "pass-screen__action", children: (0, jsx_runtime_1.jsx)(ActionButton_1.default, { uiState: uiState, onSubmit: () => { }, onRetry: () => { }, onNextMission: onNextMission }) })] }));
};
exports.default = PassScreen;
//# sourceMappingURL=PassScreen.js.map