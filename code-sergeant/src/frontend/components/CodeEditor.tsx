import React, { useEffect, useRef, useState } from 'react';
import * as monaco from 'monaco-editor';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  readOnly: boolean;
}

/**
 * Monaco Editor wrapper for the VS Code webview.
 * Uses the vs-dark theme to match VS Code.
 * Falls back to a styled <textarea> if Monaco fails to initialize.
 *
 * Worker-free: Monaco's Monarch tokenizer handles syntax highlighting
 * in the main thread. Advanced features (IntelliSense) are disabled.
 */
const CodeEditor: React.FC<CodeEditorProps> = ({ value, onChange, readOnly }) => {
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
    } catch (err) {
      console.warn('[CodeEditor] Monaco failed to initialize, using fallback textarea:', err);
      setUseFallback(true);
    }
  }, [useFallback]); // eslint-disable-line react-hooks/exhaustive-deps

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
  }, [value]);

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
