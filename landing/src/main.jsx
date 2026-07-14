import React from 'react';
import { createRoot } from 'react-dom/client';
// Geist is the brand guide's primary typeface. Self-hosted through Fontsource
// rather than a Google Fonts <link>: no third-party request (which would sit
// oddly on a page whose pitch is "local-first, no middleman"), and the font is
// bundled+fingerprinted by Vite, so it can't be the slow hop that costs LCP.
// Registers the family as 'Geist Variable' — see tailwind.config.js.
import '@fontsource-variable/geist';
import App from './App.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
