import { useEffect, useState } from 'react';
import { api } from './lib/api.js';
import Onboarding from './components/Onboarding.jsx';
import ReviewFlow from './ReviewFlow.jsx';
import BackgroundEffects from './components/extension-ui/BackgroundEffects/BackgroundEffects.jsx';

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
    return (
      <>
        <BackgroundEffects />
        <div className="relative flex min-h-screen items-center justify-center gap-2 text-body text-ink-secondary">
          <span className="h-2 w-2 animate-pulse rounded-full bg-brand" />
          Loading…
        </div>
      </>
    );
  }

  if (status === 'server-error') {
    return (
      <>
        <BackgroundEffects />
        <div className="relative mx-auto w-full max-w-[500px] space-y-2 p-3 sm:p-4">
          <Header showSettings={false} />
          <div className="min-w-0 break-words rounded-card border border-red-500/25 bg-red-950/30 p-3 text-body text-red-300 backdrop-blur-md">
            <p className="font-medium text-red-200">Can't reach the local server.</p>
            <p className="mt-1 text-ink-secondary">
              Make sure <code className="text-ink-primary">server/</code> is running (
              <code className="text-ink-primary">npm run dev</code> in{' '}
              <code className="text-ink-primary">server/</code>).
            </p>
            <p className="mt-2 text-caption text-ink-muted">{loadError}</p>
          </div>
        </div>
      </>
    );
  }

  if (status === 'onboarding') {
    return (
      <>
        <BackgroundEffects />
        <div className="relative">
          <Onboarding initialProfile={profile} initialSettings={settings} onSaved={load} />
        </div>
      </>
    );
  }

  return (
    <>
      <BackgroundEffects />
      <div className="relative mx-auto w-full min-w-0 max-w-[500px]">
        <Header onSettings={() => setStatus('onboarding')} />
        <ReviewFlow />
      </div>
    </>
  );
}

function Header({ onSettings, showSettings = true }) {
  return (
    <div className="glass-surface flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-none border-x-0 border-t-0 px-3 py-3 sm:px-4">
      <div className="flex min-w-0 items-center gap-2">
        <img src="./icons/icon-32.png" alt="" className="h-6 w-6 shrink-0 drop-shadow-[0_0_6px_rgba(40,201,78,0.45)]" />
        <h1 className="truncate text-title text-ink-primary">Impleo</h1>
      </div>
      {showSettings && (
        <button
          className="shrink-0 rounded-btn border border-surface-border bg-surface-card px-2.5 py-1 text-caption text-ink-secondary transition-colors duration-150 hover:bg-surface-card-hover hover:text-ink-primary"
          onClick={onSettings}
        >
          Settings
        </button>
      )}
    </div>
  );
}
