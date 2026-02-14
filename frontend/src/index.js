import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import './i18n';
import App from './App';
import reportWebVitals from './reportWebVitals';

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

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

reportWebVitals();
