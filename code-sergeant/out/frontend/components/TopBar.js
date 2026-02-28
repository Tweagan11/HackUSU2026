"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const SergeantFace_1 = __importDefault(require("./SergeantFace"));
/**
 * Top command bar:
 *   Left:   Mission name
 *   Center: Mission timer with blinking cursor
 *   Right:  Sergeant face sprite
 */
const TopBar = ({ mood, timeLeftSec }) => {
    const minutes = Math.floor(timeLeftSec / 60)
        .toString()
        .padStart(2, '0');
    const seconds = (timeLeftSec % 60).toString().padStart(2, '0');
    return ((0, jsx_runtime_1.jsxs)("div", { className: "top-bar", children: [(0, jsx_runtime_1.jsx)("div", { className: "top-bar__mission", children: "MISSION: FIX THE NULL POINTER" }), (0, jsx_runtime_1.jsxs)("div", { className: "top-bar__status", children: ["TIMER: ", minutes, ":", seconds, (0, jsx_runtime_1.jsx)("span", { className: "top-bar__cursor", children: "\u258A" })] }), (0, jsx_runtime_1.jsx)(SergeantFace_1.default, { mood: mood })] }));
};
exports.default = TopBar;
//# sourceMappingURL=TopBar.js.map