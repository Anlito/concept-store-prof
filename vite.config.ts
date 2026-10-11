import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

// L'outil professeur réutilise le code des deux outils élèves, lu à la construction (pas de copie) :
//   CS3D_DIR    → Concept Store 3D (vue 3D, plan, modèle)   — par défaut ../ConceptStore3D
//   VITRINE_DIR → Vitrine (fabrication du site)              — par défaut ../ConceptStoreSite
// Sur GitHub, le workflow les récupère dans deps/ et fixe ces deux variables.
const CS3D = resolve(process.env.CS3D_DIR ?? '../ConceptStore3D');
const VITRINE = resolve(process.env.VITRINE_DIR ?? '../ConceptStoreSite');
const stub = resolve(CS3D, 'src/stubs/empty.ts');
const version = (p: string) => JSON.parse(readFileSync(resolve(p, 'package.json'), 'utf8')).version as string;

export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(version('.')),
    __CS3D_VERSION__: JSON.stringify(version(CS3D)),
  },
  plugins: [react()],
  resolve: {
    alias: { '@cs3d': resolve(CS3D, 'src'), '@vitrine': resolve(VITRINE, 'src'), html2canvas: stub, dompurify: stub, canvg: stub },
  },
  server: { fs: { allow: ['.', CS3D, VITRINE] } },
  build: { target: 'es2022', outDir: 'dist', chunkSizeWarningLimit: 20000 },
});
