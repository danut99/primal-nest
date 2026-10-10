/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { transform } from 'esbuild';

/** Runtime-ul Spine stă necompilat în public/ (se încarcă la cerere); la build îl minificăm în dist. */
function minifySpineRuntime() {
  return {
    name: 'minify-spine-runtime',
    apply: 'build' as const,
    async closeBundle() {
      const file = fileURLToPath(new URL('./dist/dinosaurs/runtime/spine-player.js', import.meta.url));
      if (!fs.existsSync(file)) return;
      const { code } = await transform(fs.readFileSync(file, 'utf8'), { minify: true, target: 'es2019' });
      fs.writeFileSync(file, code);
    },
  };
}

const { version } = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

export default defineConfig({
  plugins: [react(), minifySpineRuntime()],
  define: { __APP_VERSION__: JSON.stringify(version) },
  test: { include: ['shared/**/*.test.ts', 'src/**/*.test.ts'] },
  resolve: {
    // Regulile jocului (pure, viitor comune cu serverul): import { ... } from '@shared/game'
    alias: { '@shared': fileURLToPath(new URL('./shared', import.meta.url)) },
  },
});
