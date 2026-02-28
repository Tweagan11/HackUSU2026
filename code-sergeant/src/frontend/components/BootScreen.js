"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const config_1 = require("../config");
/**
 * Boot screen shown during BOOTING state.
 * Mimics a military system initialization sequence.
 * Lines appear one by one with staggered animation.
 * Progress bar fills over the boot duration.
 */
const BootScreen = () => {
    return ((0, jsx_runtime_1.jsxs)("div", { className: "boot-screen", children: [(0, jsx_runtime_1.jsx)("div", { className: "boot-screen__title", children: "SERGEANT DEBUGGER" }), (0, jsx_runtime_1.jsx)("div", { className: "boot-screen__subtitle", children: "TACTICAL CODE ANALYSIS UNIT" }), (0, jsx_runtime_1.jsx)("div", { className: "boot-screen__log", children: config_1.DIALOGUE.boot.map((line, i) => ((0, jsx_runtime_1.jsxs)("div", { className: "boot-screen__line", style: { animationDelay: `${i * 0.35}s` }, children: ["> ", line] }, i))) }), (0, jsx_runtime_1.jsx)("div", { className: "boot-screen__progress", children: (0, jsx_runtime_1.jsx)("div", { className: "boot-screen__progress-bar" }) })] }));
};
exports.default = BootScreen;
//# sourceMappingURL=BootScreen.js.map