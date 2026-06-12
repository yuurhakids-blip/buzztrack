import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if (typeof process !== 'undefined') {
  // Suppress MaxListenersExceededWarning coming from browser extension infrastructure
  process.on('warning', (w) => {
    if (w.name === 'MaxListenersExceededWarning') return;
    console.warn(w.message);
  });
  if (process.setMaxListeners) process.setMaxListeners(Infinity);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
