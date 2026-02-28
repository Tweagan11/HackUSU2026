"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const closeImg = require("../assets/sergeant_closed.png")
const openImg = require("../assets/sergeant_fuming.png")
const fuminImg = require("../assets/sergeant_open.png")
const MOOD_LABELS = {
    idle: 'At ease',
    suspicious: 'SUSPICIOUS',
    yelling: 'ANALYZING!',
    angry: 'FURIOUS!',
    disappointed: 'Disappointed',
    proud: 'PROUD!',
};
const SergeantFace = ({ mood }) => {
    return ((0, jsx_runtime_1.jsxs)("div", { className: `sergeant-face sergeant-face--${mood}`, children: [(0, jsx_runtime_1.jsx)("div", { className: "sergeant-face__frame", role: "img", "aria-label": MOOD_LABELS[mood], children: (0, jsx_runtime_1.jsxs)("div", { className: "sergeant-face__portrait", children: [(0, jsx_runtime_1.jsx)("div", { className: "sergeant-face__hat" }), (0, jsx_runtime_1.jsx)("div", { className: "sergeant-face__brow" }), (0, jsx_runtime_1.jsxs)("div", { className: "sergeant-face__eyes", children: [(0, jsx_runtime_1.jsx)("span", { className: "sergeant-face__eye sergeant-face__eye--left" }), (0, jsx_runtime_1.jsx)("span", { className: "sergeant-face__eye sergeant-face__eye--right" })] }), (0, jsx_runtime_1.jsx)("div", { className: "sergeant-face__nose" }), (0, jsx_runtime_1.jsx)("div", { className: "sergeant-face__mouth" }), (0, jsx_runtime_1.jsx)("div", { className: "sergeant-face__jaw" })] }) }), (0, jsx_runtime_1.jsx)("div", { className: "sergeant-face__label", children: MOOD_LABELS[mood] })] }));
};
exports.default = SergeantFace;
//# sourceMappingURL=SergeantFace.js.map