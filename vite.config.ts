import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Regulile jocului (pure, viitor comune cu serverul): import { ... } from '@shared/game'
    alias: { '@shared': fileURLToPath(new URL('./shared', import.meta.url)) },
  },
});
