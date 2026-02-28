import React from 'react';
import ReactDOM from 'react-dom/client';

// Monaco environment must be configured before any monaco-editor imports
import './monacoSetup';

// Global styles (retro tactical theme)
import './styles.css';

import App from './App';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);