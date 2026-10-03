/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';
import type { Plugin } from 'vite';

const LAB_RECIPES = fileURLToPath(new URL('./src/dragon-lab/recipes.json', import.meta.url));

/** Doar în dev: butonul „Salvează” din laboratorul de dragoni scrie rețetele în src/dragon-lab/recipes.json. */
function dragonLab(): Plugin {
  return {
    name: 'dragon-lab-save',
    configureServer(server) {
      server.middlewares.use('/__dragon-lab/save', (req, res) => {
        if (req.method !== 'POST') return void ((res.statusCode = 405), res.end());
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
          try {
            if (!Array.isArray(JSON.parse(body))) throw new Error('Se așteaptă o listă de rețete.');
            writeFileSync(LAB_RECIPES, body + '\n');
            res.end('ok');
          } catch (e) {
            res.statusCode = 400;
            res.end((e as Error).message);
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), dragonLab()],
  // Doar testele jocului (DCAT-main are testele lui, pentru node --test).
  test: { include: ['shared/**/*.test.ts', 'src/**/*.test.ts'] },
  resolve: {
    // Regulile jocului (pure, viitor comune cu serverul): import { ... } from '@shared/game'
    alias: { '@shared': fileURLToPath(new URL('./shared', import.meta.url)) },
  },
});
