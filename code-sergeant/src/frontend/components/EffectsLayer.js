"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const CONFETTI_COLORS = ['#00ff9c', '#ffcc00', '#ff3b3b', '#00aaff', '#ff66ff', '#ffffff'];
const CONFETTI_COUNT = 40;
/**
 * Visual effects layer for screen-wide animations.
 * Currently supports pixel confetti burst on PASS.
 * Positioned fixed, pointer-events: none.
 */
const EffectsLayer = ({ type }) => {
    const [particles, setParticles] = (0, react_1.useState)([]);
    (0, react_1.useEffect)(() => {
        if (type === 'confetti') {
            const pieces = Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
                id: i,
                left: `${Math.random() * 100}%`,
                color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
                delay: `${Math.random() * 1}s`,
                size: 4 + Math.random() * 8,
            }));
            setParticles(pieces);
        }
    }, [type]);
    if (type === 'confetti') {
        return ((0, jsx_runtime_1.jsx)("div", { className: "confetti-container", children: particles.map((p) => ((0, jsx_runtime_1.jsx)("div", { className: "confetti-piece", style: {
                    left: p.left,
                    backgroundColor: p.color,
                    animationDelay: p.delay,
                    width: p.size,
                    height: p.size,
                } }, p.id))) }));
    }
    return null;
};
exports.default = EffectsLayer;
//# sourceMappingURL=EffectsLayer.js.map