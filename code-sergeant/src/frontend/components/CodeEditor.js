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
let themeRegistered = false;
function ensureEditorTheme() {
    if (themeRegistered)
        return;
    monaco.editor.defineTheme('code-sergeant-theme', {
        base: 'vs-dark',
        inherit: true,
        rules: [
            { token: 'comment', foreground: '6A9955' },
            { token: 'keyword', foreground: 'C586C0' },
            { token: 'number', foreground: 'B5CEA8' },
            { token: 'string', foreground: 'CE9178' },
            { token: 'regexp', foreground: 'D16969' },
            { token: 'type', foreground: '4EC9B0' },
            { token: 'delimiter', foreground: 'D4D4D4' },
            { token: 'operator', foreground: 'D4D4D4' },
            { token: 'function', foreground: 'DCDCAA' },
            { token: 'variable', foreground: '9CDCFE' },
        ],
        colors: {
            'editor.background': '#0c1013',
            'editor.foreground': '#d7f6e6',
            'editorLineNumber.foreground': '#6b8088',
            'editorLineNumber.activeForeground': '#b7cfd5',
            'editorCursor.foreground': '#71f7b5',
            'editor.selectionBackground': '#264f78',
            'editor.inactiveSelectionBackground': '#3a3d4155',
        },
    });
    themeRegistered = true;
}
function detectLanguageFromCode(code) {
    const src = code.toLowerCase();
    if (/^\s*#include\s+<\w+/m.test(src))
        return 'cpp';
    if (/^\s*package\s+[\w.]+\s*;?/m.test(src) && /\bclass\s+\w+/m.test(src))
        return 'java';
    if (/^\s*def\s+\w+\s*\(/m.test(src) || /\bimport\s+\w+/m.test(src))
        return 'python';
    if (/\bfunc\s+\w+\s*\(/m.test(src) || /\bpackage\s+main\b/m.test(src))
        return 'go';
    if (/\bfn\s+\w+\s*\(/m.test(src) || /\blet\s+mut\b/m.test(src))
        return 'rust';
    if (/\bconsole\.log\b|\bfunction\b|=>/.test(src))
        return 'javascript';
    if (/\bconst\b|\blet\b|\binterface\b|\btype\b/.test(src))
        return 'typescript';
    if (/^\s*<([a-z][\w-]*)(\s|>)/m.test(src))
        return 'html';
    if (/^\s*\{[\s\S]*\}\s*$/m.test(src) && /"\w+"\s*:/.test(src))
        return 'json';
    return 'plaintext';
}
function normalizeLanguage(language) {
    const mapping = {
        javascriptreact: 'javascript',
        typescriptreact: 'typescript',
        shellscript: 'shell',
        plaintext: 'plaintext',
    };
    return mapping[language] ?? language;
}
function applyLanguage(editor, code, preferredLanguage) {
    const model = editor.getModel();
    if (!model)
        return;
    const preferred = normalizeLanguage(preferredLanguage);
    const detected = detectLanguageFromCode(code);
    const candidates = [preferred, detected, 'plaintext'];
    const availableIds = new Set(monaco.languages.getLanguages().map((lang) => lang.id));
    const nextLanguage = candidates.find((candidate) => availableIds.has(candidate)) ?? 'plaintext';
    if (model.getLanguageId() !== nextLanguage) {
        monaco.editor.setModelLanguage(model, nextLanguage);
    }
}
/**
 * Monaco Editor wrapper for the VS Code webview.
 * Uses the vs-dark theme to match VS Code.
 * Falls back to a styled <textarea> if Monaco fails to initialize.
 *
 * Worker-free: Monaco's Monarch tokenizer handles syntax highlighting
 * in the main thread. Advanced features (IntelliSense) are disabled.
 */
const CodeEditor = ({ value, onChange, language, readOnly, }) => {
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
            ensureEditorTheme();
            const editor = monaco.editor.create(containerRef.current, {
                value,
                language: 'plaintext',
                theme: 'code-sergeant-theme',
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
                'semanticHighlighting.enabled': false,
            });
            editor.onDidChangeModelContent(() => {
                applyLanguage(editor, editor.getValue(), language);
                if (!isSettingValue.current) {
                    onChangeRef.current(editor.getValue());
                }
            });
            applyLanguage(editor, value, language);
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
    }, [useFallback, language]); // eslint-disable-line react-hooks/exhaustive-deps
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
        if (editor) {
            applyLanguage(editor, value, language);
        }
    }, [value, language]);
    // Fallback textarea
    if (useFallback) {
        return ((0, jsx_runtime_1.jsx)("textarea", { className: "code-editor-fallback", value: value, onChange: (e) => onChange(e.target.value), readOnly: readOnly, spellCheck: false, placeholder: "// Write your fix here..." }));
    }
    return ((0, jsx_runtime_1.jsx)("div", { className: `code-editor ${readOnly ? 'code-editor--readonly' : ''}`, ref: containerRef }));
};
exports.default = CodeEditor;
//# sourceMappingURL=CodeEditor.js.map