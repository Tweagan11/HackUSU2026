"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
self.MonacoEnvironment = {
    getWorker(_workerId, _label) {
        // Create a minimal no-op worker to prevent runtime errors.
        // Monaco tries to spawn workers for language services;
        // in us VS Code webview the blob-worker approach is simplest.
        const blob = new Blob(['self.onmessage = function() {}'], { type: 'text/javascript' });
        return new Worker(URL.createObjectURL(blob));
    }
};
// Ensure syntax tokenizers are bundled for languages used in training.
require("monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution");
require("monaco-editor/esm/vs/basic-languages/typescript/typescript.contribution");
require("monaco-editor/esm/vs/basic-languages/python/python.contribution");
require("monaco-editor/esm/vs/basic-languages/cpp/cpp.contribution");
require("monaco-editor/esm/vs/basic-languages/java/java.contribution");
require("monaco-editor/esm/vs/basic-languages/go/go.contribution");
require("monaco-editor/esm/vs/basic-languages/rust/rust.contribution");
require("monaco-editor/esm/vs/basic-languages/html/html.contribution");
require("monaco-editor/esm/vs/language/json/monaco.contribution");
//# sourceMappingURL=monacoSetup.js.map