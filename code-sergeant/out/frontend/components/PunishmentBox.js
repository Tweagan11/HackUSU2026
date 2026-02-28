"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const config_1 = require("../config");
/**
 * Flashed fail-state punishment box.
 * Only visible during RESULT_FAIL state.
 * Requires writing the punishment phrase a fixed number of times.
 */
const PunishmentBox = ({ punishment, visible, progress, onLineCompleted, }) => {
    const [displayedText, setDisplayedText] = (0, react_1.useState)('');
    const [lineInput, setLineInput] = (0, react_1.useState)('');
    const [error, setError] = (0, react_1.useState)('');
    (0, react_1.useEffect)(() => {
        if (!visible || !punishment) {
            setDisplayedText('');
            setLineInput('');
            setError('');
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
    const isComplete = progress >= config_1.PUNISHMENT_REQUIRED_REPS;
    const submitLine = () => {
        const normalized = lineInput.trim().replace(/\s+/g, ' ');
        if (normalized !== config_1.PUNISHMENT_PHRASE) {
            setError(`Type exactly: "${config_1.PUNISHMENT_PHRASE}"`);
            return;
        }
        setError('');
        setLineInput('');
        if (!isComplete) {
            onLineCompleted();
        }
    };
    return ((0, jsx_runtime_1.jsxs)("div", { className: "punishment-box", children: [(0, jsx_runtime_1.jsx)("div", { className: "punishment-box__header", children: "\u26A0 PUNISHMENT \u26A0" }), (0, jsx_runtime_1.jsx)("div", { className: "punishment-box__text", children: displayedText }), (0, jsx_runtime_1.jsxs)("div", { className: "punishment-box__progress", children: [progress, "/", config_1.PUNISHMENT_REQUIRED_REPS, " completed"] }), !isComplete && ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("input", { className: "punishment-box__input", type: "text", value: lineInput, onChange: (e) => setLineInput(e.target.value), onKeyDown: (e) => {
                            if (e.key === 'Enter') {
                                submitLine();
                            }
                        }, placeholder: config_1.PUNISHMENT_PHRASE, "aria-label": "Punishment phrase input" }), (0, jsx_runtime_1.jsx)("button", { className: "punishment-box__submit", type: "button", onClick: submitLine, children: "Submit Line" })] })), error && (0, jsx_runtime_1.jsx)("div", { className: "punishment-box__error", children: error }), isComplete && ((0, jsx_runtime_1.jsx)("div", { className: "punishment-box__done", children: "Punishment complete. Retry is unlocked." }))] }));
};
exports.default = PunishmentBox;
//# sourceMappingURL=PunishmentBox.js.map