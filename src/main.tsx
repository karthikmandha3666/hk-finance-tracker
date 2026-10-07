import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Register service worker for offline PWA support
registerSW({
  immediate: true,
  onNeedRefresh() {
    console.info('[PWA] New content available.');
  },
  onOfflineReady() {
    console.info('[PWA] Application ready to work offline.');
  },
});

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
