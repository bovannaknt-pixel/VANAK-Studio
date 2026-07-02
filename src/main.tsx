import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Register Service Worker for PWA installation
if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => {
        console.log('PWA Service Worker registered successfully:', reg.scope);
        // Force checking for updates immediately on page load
        reg.update().catch((err) => console.warn('Failed to update SW:', err));

        // Check for updates on window focus or visibility change to ensure instant sync when returning to the app
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            reg.update().catch((err) => console.warn('Failed to update SW on visibility change:', err));
          }
        });
        window.addEventListener('focus', () => {
          reg.update().catch((err) => console.warn('Failed to update SW on focus:', err));
        });
      })
      .catch((err) => {
        console.error('PWA Service Worker registration failed:', err);
      });
  });

  // Automatically reload the page when a new service worker activates and takes control
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
