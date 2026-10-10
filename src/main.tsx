import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Register service worker for offline PWA support and accessible update dispatch
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    console.info('[PWA] New content available.');
    window.dispatchEvent(
      new CustomEvent('spendly-pwa-update', {
        detail: {
          updateSW: () => updateSW(true),
        },
      })
    );
  },
  onOfflineReady() {
    console.info('[PWA] Application ready to work offline.');
  },
});

// Explicitly prevent pinch-to-zoom and gesture zooming on iOS Safari
if (typeof document !== 'undefined') {
  document.addEventListener('gesturestart', (e: Event) => e.preventDefault(), { passive: false });
  document.addEventListener('gesturechange', (e: Event) => e.preventDefault(), { passive: false });
  document.addEventListener('gestureend', (e: Event) => e.preventDefault(), { passive: false });
  document.addEventListener(
    'touchmove',
    (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    },
    { passive: false }
  );
}

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
}
