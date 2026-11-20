import react from '@vitejs/plugin-react';
import { keycloakify } from 'keycloakify/vite-plugin';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    react(),
    keycloakify({
      themeName: 'cpeople',
      accountThemeImplementation: 'none',
      // The stack runs Keycloak 26, so only that jar is built; shipping a second
      // one for 22-25 would just be a jar nobody loads.
      keycloakVersionTargets: {
        '22-to-25': false,
        'all-other-versions': 'cpeople-login-theme.jar',
      },
      // Where "Book a demo" points. Each environment sets it on the Keycloak
      // container; the fallback keeps a local checkout working.
      environmentVariables: [{ name: 'CPEOPLE_BOOK_A_DEMO_URL', default: 'https://consap.ma/cpeople' }],
    }),
  ],
});
