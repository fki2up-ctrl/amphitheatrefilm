import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App.jsx';
import AlphaProdApp from './components/AlphaProdApp.jsx';
import { ContentProvider } from './store/content.jsx';
import { PhaseProvider } from './flow/PhaseProvider.jsx';
import './index.css';

// Portfolio shell — wraps the original App with its content + phase providers.
// AlphaProd is intentionally outside these providers: it's a fully isolated
// application that only depends on Supabase + TheatreAlpha's own data layer.
function PortfolioShell() {
  return (
    <ContentProvider>
      <PhaseProvider>
        <App />
      </PhaseProvider>
    </ContentProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/alphaprod/*" element={<AlphaProdApp />} />
        <Route path="/*" element={<PortfolioShell />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
