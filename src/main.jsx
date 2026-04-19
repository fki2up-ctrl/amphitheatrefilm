import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { ContentProvider } from './store/content.jsx';
import { PhaseProvider } from './flow/PhaseProvider.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ContentProvider>
      <PhaseProvider>
        <App />
      </PhaseProvider>
    </ContentProvider>
  </React.StrictMode>
);
