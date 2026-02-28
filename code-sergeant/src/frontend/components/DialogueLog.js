"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
/**
 * Terminal-style scrolling log.
 * All lines prefixed with SERGEANT:.
 * Persists across attempts.
 * Fail entries get special red styling.
 */
const DialogueLog = ({ entries }) => {
    const scrollRef = (0, react_1.useRef)(null);
    // Auto-scroll to bottom on new entries
    (0, react_1.useEffect)(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [entries]);
    return ((0, jsx_runtime_1.jsxs)("div", { className: "dialogue-log", ref: scrollRef, children: [(0, jsx_runtime_1.jsx)("div", { className: "dialogue-log__header", children: "/// COMMS LOG ///" }), entries.map((entry, i) => ((0, jsx_runtime_1.jsxs)("div", { className: `dialogue-log__entry ${entry.type === 'fail' ? 'dialogue-log__entry--fail' : ''}`, children: [(0, jsx_runtime_1.jsx)("span", { className: "dialogue-log__prefix", children: "SERGEANT:" }), ' ', (0, jsx_runtime_1.jsx)("span", { className: "dialogue-log__text", children: entry.text })] }, `${entry.timestamp}-${i}`))), (0, jsx_runtime_1.jsx)("div", { className: "dialogue-log__cursor", children: "\u258A" })] }));
};
exports.default = DialogueLog;
//# sourceMappingURL=DialogueLog.js.map