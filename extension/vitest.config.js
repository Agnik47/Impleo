// Separate from vite.config.js on purpose. That config sets `root:
// 'src/sidepanel'` so the extension builds with the side panel's index.html as
// its entry — inheriting that root here would hide every test under `test/`
// from discovery. This config keeps the extension/ directory as the root and
// only describes how tests run.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.js'],
    // Installs the in-memory chrome.storage stub before any lib/ module is
    // imported. lib/storage.js is the only module that touches chrome.storage,
    // so this one stub makes the entire lib/ layer runnable outside a browser.
    setupFiles: ['test/setup/vitest.setup.js'],
  },
});
