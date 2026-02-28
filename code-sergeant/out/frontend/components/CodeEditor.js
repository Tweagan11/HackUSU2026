"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const monaco = __importStar(require("monaco-editor"));
/**
 * Monaco Editor wrapper for the VS Code webview.
 * Uses the vs-dark theme to match VS Code.
 * Falls back to a styled <textarea> if Monaco fails to initialize.
 *
 * Worker-free: Monaco's Monarch tokenizer handles syntax highlighting
 * in the main thread. Advanced features (IntelliSense) are disabled.
 */
const CodeEditor = ({ value, onChange, readOnly }) => {
    const containerRef = (0, react_1.useRef)(null);
    const editorRef = (0, react_1.useRef)(null);
    const isSettingValue = (0, react_1.useRef)(false);
    const onChangeRef = (0, react_1.useRef)(onChange);
    const [useFallback, setUseFallback] = (0, react_1.useState)(false);
    // Keep onChange ref current without re-creating the editor
    (0, react_1.useEffect)(() => {
        onChangeRef.current = onChange;
    }, [onChange]);
    // Initialize Monaco editor
    (0, react_1.useEffect)(() => {
        if (!containerRef.current || useFallback)
            return;
        try {
            const editor = monaco.editor.create(containerRef.current, {
                value,
                language: 'javascript',
                theme: 'vs-dark',
                readOnly,
                minimap: { enabled: false },
                fontSize: 14,
                fontFamily: "'Fira Code', 'JetBrains Mono', 'Courier New', monospace",
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                padding: { top: 12 },
                renderLineHighlight: 'all',
                cursorBlinking: 'phase',
                // Disable features that require workers
                quickSuggestions: false,
                parameterHints: { enabled: false },
                suggestOnTriggerCharacters: false,
                acceptSuggestionOnEnter: 'off',
                tabCompletion: 'off',
                wordBasedSuggestions: 'off',
            });
            editor.onDidChangeModelContent(() => {
                if (!isSettingValue.current) {
                    onChangeRef.current(editor.getValue());
                }
            });
            editorRef.current = editor;
            return () => {
                editor.dispose();
                editorRef.current = null;
            };
        }
        catch (err) {
            console.warn('[CodeEditor] Monaco failed to initialize, using fallback textarea:', err);
            setUseFallback(true);
        }
    }, [useFallback]); // eslint-disable-line react-hooks/exhaustive-deps
    // Sync readOnly prop
    (0, react_1.useEffect)(() => {
        editorRef.current?.updateOptions({ readOnly });
    }, [readOnly]);
    // Sync external value changes
    (0, react_1.useEffect)(() => {
        const editor = editorRef.current;
        if (editor && editor.getValue() !== value) {
            isSettingValue.current = true;
            editor.setValue(value);
            isSettingValue.current = false;
        }
    }, [value]);
    // Fallback textarea
    if (useFallback) {
        return ((0, jsx_runtime_1.jsx)("textarea", { className: "code-editor-fallback", value: value, onChange: (e) => onChange(e.target.value), readOnly: readOnly, spellCheck: false, placeholder: "// Write your fix here..." }));
    }
    return ((0, jsx_runtime_1.jsx)("div", { className: `code-editor ${readOnly ? 'code-editor--readonly' : ''}`, ref: containerRef }));
};
exports.default = CodeEditor;
//# sourceMappingURL=CodeEditor.js.map