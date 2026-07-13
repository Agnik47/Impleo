import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Standalone marketing site — separate from the extension (extension/) and the
// local server (server/). It is intentionally its own Vite app so it can be
// deployed to a static host without pulling in MV3/extension concerns.
export default defineConfig({
  plugins: [react()],
});
