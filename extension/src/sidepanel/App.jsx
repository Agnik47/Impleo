import { useEffect, useState } from 'react';
import { api } from './lib/api.js';
import Onboarding from './components/Onboarding.jsx';
import ReviewFlow from './ReviewFlow.jsx';

export default function App() {
  const [status, setStatus] = useState('loading'); // loading | onboarding | main | server-error
  const [profile, setProfile] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loadError, setLoadError] = useState(null);

  async function load() {
    setStatus('loading');
    setLoadError(null);
    try {
      const [profileResult, settingsResult] = await Promise.all([
        api.getProfile(),
        api.getSettings(),
      ]);
      setProfile(profileResult);
      setSettings(settingsResult);
      // "Configured" = an active provider is picked and it has a key saved.
      const active = settingsResult.providers.find((p) => p.id === settingsResult.provider);
      const isConfigured = Boolean(active && active.hasKey);
      setStatus(profileResult && isConfigured ? 'main' : 'onboarding');
    } catch (err) {
      setLoadError(err.message);
      setStatus('server-error');
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (status === 'loading') {
    return <p className="p-4 text-sm text-slate-500">Loading…</p>;
  }

  if (status === 'server-error') {
    return (
      <div className="p-4 text-sm text-red-600">
        <p className="font-medium">Can't reach the local server.</p>
        <p className="text-slate-700">
          Make sure <code>server/</code> is running (<code>npm run dev</code> in{' '}
          <code>server/</code>).
        </p>
        <p className="mt-2 text-xs text-slate-500">{loadError}</p>
      </div>
    );
  }

  if (status === 'onboarding') {
    return <Onboarding initialProfile={profile} initialSettings={settings} onSaved={load} />;
  }

  return (
    <div>
      <div className="flex items-center justify-between border-b border-slate-100 p-4 pb-3 text-sm">
        <h1 className="text-lg font-semibold">Christopher</h1>
        <button
          className="rounded bg-slate-200 px-2 py-1 text-xs hover:bg-slate-300"
          onClick={() => setStatus('onboarding')}
        >
          Settings
        </button>
      </div>
      <ReviewFlow />
    </div>
  );
}
