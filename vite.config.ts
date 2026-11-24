import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import presentation from './framework/vite-plugin.ts';

// Used by `npm run dev`. The production build (framework/build.ts) has its own per-page configs.
export default defineConfig({
  plugins: [react(), presentation()],
  server: { open: true, port: 5173 },
});
