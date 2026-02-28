"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
/**
 * Phone call panel — allows the user to enter their phone number
 * and summon the sergeant to call them via Twilio + ElevenLabs.
 *
 * Shows different states:
 *   idle    → phone input + "CALL SERGEANT" button
 *   calling → "Connecting..." indicator
 *   in-progress → "Sergeant is on the line" + pulsing indicator
 *   ended   → "Call ended" message
 *   error   → error message + retry
 */
const CallPanel = ({ callStatus, callError, phoneNumber, onPhoneNumberChange, onCallSergeant, }) => {
    const [inputFocused, setInputFocused] = (0, react_1.useState)(false);
    const isCallActive = callStatus === 'calling' || callStatus === 'in-progress';
    const canCall = callStatus === 'idle' || callStatus === 'ended' || callStatus === 'error';
    return ((0, jsx_runtime_1.jsxs)("div", { className: "call-panel", children: [(0, jsx_runtime_1.jsx)("div", { className: "call-panel__header", children: "\uD83D\uDCDE COMMS CHANNEL" }), (0, jsx_runtime_1.jsx)("div", { className: `call-panel__input-group ${inputFocused ? 'call-panel__input-group--focused' : ''}`, children: (0, jsx_runtime_1.jsx)("input", { className: "call-panel__input", type: "tel", placeholder: "+1 (555) 123-4567", value: phoneNumber, onChange: (e) => onPhoneNumberChange(e.target.value), onFocus: () => setInputFocused(true), onBlur: () => setInputFocused(false), disabled: isCallActive, autoComplete: "tel" }) }), (0, jsx_runtime_1.jsxs)("button", { className: `call-panel__button ${isCallActive ? 'call-panel__button--active' : ''}`, onClick: onCallSergeant, disabled: !canCall || !phoneNumber.trim(), children: [callStatus === 'idle' && '📞 CALL THE SERGEANT', callStatus === 'calling' && '⏳ CONNECTING...', callStatus === 'in-progress' && '🔊 SERGEANT ON THE LINE', callStatus === 'ended' && '📞 CALL AGAIN', callStatus === 'error' && '📞 RETRY CALL'] }), callStatus === 'calling' && ((0, jsx_runtime_1.jsxs)("div", { className: "call-panel__status call-panel__status--calling", children: [(0, jsx_runtime_1.jsx)("span", { className: "call-panel__pulse" }), "Dialing Sergeant Debugger\u2026"] })), callStatus === 'in-progress' && ((0, jsx_runtime_1.jsxs)("div", { className: "call-panel__status call-panel__status--active", children: [(0, jsx_runtime_1.jsx)("span", { className: "call-panel__pulse call-panel__pulse--green" }), "SERGEANT IS ON THE LINE \u2014 ANSWER YOUR PHONE!"] })), callStatus === 'ended' && ((0, jsx_runtime_1.jsx)("div", { className: "call-panel__status call-panel__status--ended", children: "Call ended. Back to work, recruit." })), callStatus === 'error' && ((0, jsx_runtime_1.jsxs)("div", { className: "call-panel__status call-panel__status--error", children: ["COMMS ERROR: ", callError] }))] }));
};
exports.default = CallPanel;
//# sourceMappingURL=CallPanel.js.map