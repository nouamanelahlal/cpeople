import { createRoot } from 'react-dom/client';
import { StrictMode } from 'react';
import { KcPage, type KcContext } from './kc.gen';

// The Keycloak page context is injected into the page by Keycloak itself; in the
// Vite dev server it comes from the mock context instead.
declare global {
  interface Window {
    kcContext?: KcContext;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {window.kcContext ? <KcPage kcContext={window.kcContext} /> : <h1>No Keycloak context</h1>}
  </StrictMode>,
);
