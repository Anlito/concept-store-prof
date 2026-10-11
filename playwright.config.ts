import { defineConfig } from '@playwright/test';

// Les tests ouvrent l'outil construit (dist/) servi en http://localhost (comme sur GitHub Pages).
// Lancer « npm run build » avant « npm test ».
export default defineConfig({
  testDir: 'tests',
  timeout: 60_000,
  fullyParallel: true,
  reporter: [['list']],
  webServer: { command: 'node scripts/serve.mjs dist 8090', port: 8090, reuseExistingServer: true },
  use: {
    baseURL: 'http://localhost:8090/',
    viewport: { width: 1366, height: 768 },
    locale: 'fr-FR',
    launchOptions: { args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
  },
});
