/**
 * Monaco Editor environment configuration.
 * Must be imported BEFORE any monaco-editor imports.
 * Configures Monaco to work without full web workers
 * in the VS Code webview environment.
 *
 * Monaco core editor features (syntax highlighting, editing,
 * folding) work via the Monarch tokenizer in the main thread.
 * Only advanced features (IntelliSense, diagnostics) require workers.
 */
(self as any).MonacoEnvironment = {
  getWorker(_workerId: string, _label: string) {
    // Create a minimal no-op worker to prevent runtime errors.
    // Monaco tries to spawn workers for language services;
    // in us VS Code webview the blob-worker approach is simplest.
    const blob = new Blob(
      ['self.onmessage = function() {}'],
      { type: 'text/javascript' }
    );
    return new Worker(URL.createObjectURL(blob));
  }
};

// Ensure syntax tokenizers are bundled for languages used in training.
import 'monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution';
import 'monaco-editor/esm/vs/basic-languages/typescript/typescript.contribution';
import 'monaco-editor/esm/vs/basic-languages/python/python.contribution';
import 'monaco-editor/esm/vs/basic-languages/cpp/cpp.contribution';
import 'monaco-editor/esm/vs/basic-languages/java/java.contribution';
import 'monaco-editor/esm/vs/basic-languages/go/go.contribution';
import 'monaco-editor/esm/vs/basic-languages/rust/rust.contribution';
import 'monaco-editor/esm/vs/basic-languages/html/html.contribution';
import 'monaco-editor/esm/vs/language/json/monaco.contribution';

export {};
