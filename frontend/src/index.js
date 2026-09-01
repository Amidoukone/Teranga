import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import './i18n';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { initTheme } from './utils/theme';

/* ============================================================
   🚫 Patch PRO : Ignore ResizeObserver loop limit errors
   (uniquement ces erreurs → laisse passer les autres)
============================================================ */
const ignoreResizeObserverError = (event) => {
  if (
    event.message &&
    event.message.includes("ResizeObserver loop completed")
  ) {
    event.stopImmediatePropagation();
  }
};
window.addEventListener("error", ignoreResizeObserverError);
window.addEventListener("unhandledrejection", ignoreResizeObserverError);
/* ============================================================ */
initTheme();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

reportWebVitals();

if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((error) => {
      // Le mode en ligne reste pleinement fonctionnel si le navigateur refuse le cache offline.
      console.warn('Teranga offline shell unavailable:', error);
    });
  });
}
