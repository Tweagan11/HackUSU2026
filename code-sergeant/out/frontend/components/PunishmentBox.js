"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
/**
 * Flashing red bordered punishment box with typewriter effect.
 * Only visible during RESULT_FAIL state.
 * Shows a random punishment string animated character by character.
 */
const PunishmentBox = ({ punishment, visible }) => {
    const [displayedText, setDisplayedText] = (0, react_1.useState)('');
    (0, react_1.useEffect)(() => {
        if (!visible || !punishment) {
            setDisplayedText('');
            return;
        }
        let index = 0;
        setDisplayedText('');
        const interval = setInterval(() => {
            index++;
            setDisplayedText(punishment.slice(0, index));
            if (index >= punishment.length) {
                clearInterval(interval);
            }
        }, 30);
        return () => clearInterval(interval);
    }, [punishment, visible]);
    if (!visible)
        return null;
    return ((0, jsx_runtime_1.jsxs)("div", { className: "punishment-box", children: [(0, jsx_runtime_1.jsx)("div", { className: "punishment-box__header", children: "\u26A0 PUNISHMENT \u26A0" }), (0, jsx_runtime_1.jsx)("div", { className: "punishment-box__text", children: displayedText })] }));
};
exports.default = PunishmentBox;
//# sourceMappingURL=PunishmentBox.js.map