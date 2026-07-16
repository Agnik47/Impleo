import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import CorsSpike from './CorsSpike.jsx';
import './index.css';

// PHASE 0 SPIKE — TEMPORARY. Revert this file and delete CorsSpike.jsx before Phase 1.
// Flip to false to get the normal app back without touching anything else.
const RUN_CORS_SPIKE = true;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>{RUN_CORS_SPIKE ? <CorsSpike /> : <App />}</React.StrictMode>
);
