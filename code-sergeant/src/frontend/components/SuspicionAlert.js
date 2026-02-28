"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
/**
 * Cinematic warning that the sergeant suspects lurking bugs.
 * Renders between the boot screen and training splash.
 */
const SuspicionAlert = () => {
    return ((0, jsx_runtime_1.jsxs)("div", { className: "suspicion-alert", role: "alert", "aria-live": "assertive", children: [(0, jsx_runtime_1.jsx)("div", { className: "suspicion-alert__badge", children: "CODE WATCH" }), (0, jsx_runtime_1.jsx)("div", { className: "suspicion-alert__headline", children: "SERGEANT IS SUSPICIOUS" }), (0, jsx_runtime_1.jsx)("p", { className: "suspicion-alert__subtext", children: "Sensors picked up irregular stack traces. There may be bugs hiding in your code \u2014 stay sharp." }), (0, jsx_runtime_1.jsxs)("div", { className: "suspicion-alert__scanner", children: [(0, jsx_runtime_1.jsx)("div", { className: "suspicion-alert__scanner-grid", children: Array.from({ length: 12 }).map((_, idx) => ((0, jsx_runtime_1.jsx)("span", { className: "suspicion-alert__scanner-dot" }, idx))) }), (0, jsx_runtime_1.jsx)("div", { className: "suspicion-alert__scanner-line" })] }), (0, jsx_runtime_1.jsx)("div", { className: "suspicion-alert__cta", children: "Prepare to squash anything that twitches." })] }));
};
exports.default = SuspicionAlert;
//# sourceMappingURL=SuspicionAlert.js.map