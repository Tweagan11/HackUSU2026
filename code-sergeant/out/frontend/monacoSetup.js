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
//# sourceMappingURL=monacoSetup.js.map