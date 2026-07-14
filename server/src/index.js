import express from 'express';
import cors from 'cors';
import './db.js';
import profileRouter from './routes/profile.js';
import settingsRouter from './routes/settings.js';
import qaHistoryRouter from './routes/qa-history.js';
import testKeyRouter from './routes/test-key.js';
import generateRouter from './routes/generate.js';
import importExportRouter from './routes/import-export.js';
import identityMemoryRouter from './routes/identity-memory.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Only the extension (chrome-extension://<id>) may call this API — an
// ordinary web page's Origin is always http(s)://, so this blocks the
// "malicious tab reads your profile/API key over localhost" attack a
// wide-open cors() would otherwise allow.
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || origin.startsWith('chrome-extension://')) {
        return callback(null, true);
      }
      const err = new Error('Not allowed by CORS');
      err.status = 403;
      return callback(err);
    },
  })
);
app.use(express.json({ limit: '2mb' }));

app.use('/api/profile', profileRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/qa-history', qaHistoryRouter);
app.use('/api/identity-memory', identityMemoryRouter);
app.use('/api/test-key', testKeyRouter);
app.use('/api', generateRouter);
app.use('/api', importExportRouter);

// Safety net: any route that throws (sync) or forwards via next(err) lands
// here instead of Express's default HTML error page, which api.js's
// JSON-only parsing can't read.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ ok: false, error: err.message || 'Internal server error' });
});

app.get('/', (req,res)=> {
  res.send('Server is Running')
});


// Loopback-only: an unbound listen() also accepts connections from other
// devices on the same network, which chrome.storage.local never exposed.
app.listen(PORT, '127.0.0.1', () => {
  console.log(`Impleo server listening on http://localhost:${PORT}`);
});
