"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
/** Screen that holds the user until the backend delivers a challenge. */
const BriefingHold = () => {
    return ((0, jsx_runtime_1.jsxs)("div", { className: "briefing-hold", role: "status", "aria-live": "polite", children: [(0, jsx_runtime_1.jsxs)("div", { className: "briefing-hold__radar", children: [(0, jsx_runtime_1.jsx)("div", { className: "briefing-hold__radar-line" }), (0, jsx_runtime_1.jsx)("div", { className: "briefing-hold__radar-pulse" })] }), (0, jsx_runtime_1.jsx)("div", { className: "briefing-hold__title", children: "Awaiting Mission Briefing\u2026" }), (0, jsx_runtime_1.jsx)("p", { className: "briefing-hold__text", children: "The Sergeant is scanning your workspace for the next objective. Stand by while intel is compiled." })] }));
};
exports.default = BriefingHold;
//# sourceMappingURL=BriefingHold.js.map