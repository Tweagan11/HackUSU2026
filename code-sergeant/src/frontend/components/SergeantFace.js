"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
// image imports (webpack handles these)
const idleImg = require("../assets/sergeant-idle.png");
const suspiciousImg = require("../assets/sergeant-suspicious.png");
const yellingImg = require("../assets/sergeant-yelling.png");
const angryImg = require("../assets/sergeant-angry.png");
const disappointedImg = require("../assets/sergeant-disappointed.png");
const proudImg = require("../assets/sergeant-proud.png");

const MOOD_LABELS = {
    idle: 'At ease',
    suspicious: 'SUSPICIOUS',
    yelling: 'ANALYZING!',
    angry: 'FURIOUS!',
    disappointed: 'Disappointed',
    proud: 'PROUD!',
};

const MOOD_IMAGES = {
    idle: idleImg,
    suspicious: suspiciousImg,
    yelling: yellingImg,
    angry: angryImg,
    disappointed: disappointedImg,
    proud: proudImg,
};

const SergeantFace = ({ mood }) => {
    return ((0, jsx_runtime_1.jsxs)("div", { className: `sergeant-face sergeant-face--${mood}`, children: [(0, jsx_runtime_1.jsx)("img", { className: "sergeant-face__image", src: MOOD_IMAGES[mood], alt: MOOD_LABELS[mood] }), (0, jsx_runtime_1.jsx)("div", { className: "sergeant-face__label", children: MOOD_LABELS[mood] })] }));
};
exports.default = SergeantFace;
//# sourceMappingURL=SergeantFace.js.map