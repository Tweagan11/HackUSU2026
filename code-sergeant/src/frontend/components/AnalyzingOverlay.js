"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
/**
 * Full-screen translucent overlay shown during ANALYZING state.
 * Locks the UI and displays an indeterminate progress bar.
 */
const AnalyzingOverlay = () => {
    return ((0, jsx_runtime_1.jsxs)("div", { className: "analyzing-overlay", children: [(0, jsx_runtime_1.jsx)("div", { className: "analyzing-overlay__text", children: "ANALYZING YOUR PITIFUL CODE\u2026" }), (0, jsx_runtime_1.jsx)("div", { className: "analyzing-overlay__subtext", children: "Stand by for judgment, recruit." }), (0, jsx_runtime_1.jsx)("div", { className: "analyzing-overlay__progress", children: (0, jsx_runtime_1.jsx)("div", { className: "analyzing-overlay__progress-bar" }) })] }));
};
exports.default = AnalyzingOverlay;
//# sourceMappingURL=AnalyzingOverlay.js.map