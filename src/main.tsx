import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { DialogProvider, ToastProvider } from './ui';
import './styles/globals.css';

window.addEventListener('error', (event) => {
  console.error('[Renderer] Unhandled error:', event.message, event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Renderer] Unhandled promise rejection:', event.reason);
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ToastProvider>
      <DialogProvider>
        <App />
      </DialogProvider>
    </ToastProvider>
  </React.StrictMode>
);
