import React, { useEffect, useRef, useState } from 'react';
import * as monaco from 'monaco-editor';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: string;
  readOnly: boolean;
}

let themeRegistered = false;

function ensureEditorTheme(): void {
  if (themeRegistered) return;
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

function detectLanguageFromCode(code: string): string {
  const src = code.toLowerCase();
  if (/^\s*#include\s+<\w+/m.test(src)) return 'cpp';
  if (/^\s*package\s+[\w.]+\s*;?/m.test(src) && /\bclass\s+\w+/m.test(src)) return 'java';
  if (/^\s*def\s+\w+\s*\(/m.test(src) || /\bimport\s+\w+/m.test(src)) return 'python';
  if (/\bfunc\s+\w+\s*\(/m.test(src) || /\bpackage\s+main\b/m.test(src)) return 'go';
  if (/\bfn\s+\w+\s*\(/m.test(src) || /\blet\s+mut\b/m.test(src)) return 'rust';
  if (/\bconsole\.log\b|\bfunction\b|=>/.test(src)) return 'javascript';
  if (/\bconst\b|\blet\b|\binterface\b|\btype\b/.test(src)) return 'typescript';
  if (/^\s*<([a-z][\w-]*)(\s|>)/m.test(src)) return 'html';
  if (/^\s*\{[\s\S]*\}\s*$/m.test(src) && /"\w+"\s*:/.test(src)) return 'json';
  return 'plaintext';
}

function normalizeLanguage(language: string): string {
  const mapping: Record<string, string> = {
    javascriptreact: 'javascript',
    typescriptreact: 'typescript',
    shellscript: 'shell',
    plaintext: 'plaintext',
  };
  return mapping[language] ?? language;
}

function applyLanguage(
  editor: monaco.editor.IStandaloneCodeEditor,
  code: string,
  preferredLanguage: string
): void {
  const model = editor.getModel();
  if (!model) return;
  const preferred = normalizeLanguage(preferredLanguage);
  const detected = detectLanguageFromCode(code);
  const candidates = [preferred, detected, 'plaintext'];
  const availableIds = new Set(monaco.languages.getLanguages().map((lang) => lang.id));
  const nextLanguage =
    candidates.find((candidate) => availableIds.has(candidate)) ?? 'plaintext';
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
const CodeEditor: React.FC<CodeEditorProps> = ({
  value,
  onChange,
  language,
  readOnly,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const isSettingValue = useRef(false);
  const onChangeRef = useRef(onChange);
  const [useFallback, setUseFallback] = useState(false);

  // Keep onChange ref current without re-creating the editor
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Initialize Monaco editor
  useEffect(() => {
    if (!containerRef.current || useFallback) return;

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
    } catch (err) {
      console.warn('[CodeEditor] Monaco failed to initialize, using fallback textarea:', err);
      setUseFallback(true);
    }
  }, [useFallback, language]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync readOnly prop
  useEffect(() => {
    editorRef.current?.updateOptions({ readOnly });
  }, [readOnly]);

  // Sync external value changes
  useEffect(() => {
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
    return (
      <textarea
        className="code-editor-fallback"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readOnly}
        spellCheck={false}
        placeholder="// Write your fix here..."
      />
    );
  }

  return (
    <div
      className={`code-editor ${readOnly ? 'code-editor--readonly' : ''}`}
      ref={containerRef}
    />
  );
};

export default CodeEditor;
