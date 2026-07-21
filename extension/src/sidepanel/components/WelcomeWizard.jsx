import { useState } from 'react';

// Per-provider hints for the key input placeholder — just a nudge on what a
// given vendor's key looks like, not validation. Kept in sync with the copy
// in Onboarding.jsx's own KEY_HINTS.
const KEY_HINTS = {
  anthropic: 'sk-ant-...',
  gemini: 'AIza... (or another Google AI Studio key format)',
  openai: 'sk-...',
  groq: 'gsk_...',
};

const inputClass =
  'w-full rounded-input border border-surface-border bg-surface-bg px-2.5 py-1.5 text-body text-ink-primary placeholder:text-ink-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand transition-colors duration-150';
const secondaryBtn =
  'rounded-btn border border-surface-border bg-surface-card-hover px-3 py-1.5 text-body text-ink-primary transition-colors duration-150 hover:bg-surface-border disabled:opacity-50';
const primaryBtn =
  'rounded-btn bg-brand px-4 py-1.5 text-body font-medium text-jungle shadow-soft-sm transition-colors duration-150 hover:bg-brand-hover disabled:opacity-50';
const ghostBtn =
  'text-caption text-ink-muted underline-offset-2 transition-colors duration-150 hover:text-ink-secondary hover:underline';

function StepDots({ step, total }) {
  return (
    <div className="flex items-center justify-center gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-1.5 rounded-full transition-all duration-200 ${
            i === step ? 'w-5 bg-brand' : 'w-1.5 bg-surface-border'
          }`}
        />
      ))}
    </div>
  );
}

function SparkleIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />
    </svg>
  );
}

function KeyIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="8" cy="15" r="4" />
      <path d="M10.5 12.5 20 3M17 6l2 2M14 9l2 2" />
    </svg>
  );
}

function UploadIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 16V4M12 4l-4 4M12 4l4 4" />
      <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

export default function WelcomeWizard({
  open,
  providers,
  provider,
  apiKey,
  model,
  keyStatus,
  testing,
  savedKeyProviders,
  providerLabel,
  onProviderChange,
  onApiKeyChange,
  onModelChange,
  onTestKey,
  onImportNow,
  onManualSetup,
}) {
  const [step, setStep] = useState(0);
  if (!open) return null;

  const hasKey = apiKey || savedKeyProviders.has(provider);
  const totalSteps = 3;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-surface-bg"
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Impleo"
    >
      <div className="mx-auto flex h-full w-full max-w-[500px] flex-col">
        <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
          {/* Step 0 — Welcome */}
          {step === 0 && (
            <div className="flex h-full min-h-[420px] flex-col items-center justify-center gap-5 text-center">
              <div className="glass-surface flex h-16 w-16 items-center justify-center rounded-full">
                <img src="./icons/icon-32.png" alt="" className="h-9 w-9" />
              </div>
              <div className="space-y-2">
                <h1 className="chameleon-text text-2xl font-semibold">Welcome to Impleo</h1>
                <p className="max-w-[360px] text-body text-ink-secondary">
                  Impleo auto-fills job and scholarship applications from your profile, using AI to
                  answer questions the way you would.
                </p>
              </div>
              <p className="max-w-[360px] text-caption text-ink-muted">
                Let's get you set up — it only takes two quick steps.
              </p>
              <button type="button" onClick={() => setStep(1)} className={`${primaryBtn} mt-2 w-full max-w-[280px]`}>
                Get started
              </button>
              <button type="button" onClick={onManualSetup} className={ghostBtn}>
                Skip — I'll set everything up myself
              </button>
            </div>
          )}

          {/* Step 1 — AI provider setup */}
          {step === 1 && (
            <div className="flex h-full min-h-[420px] flex-col justify-center gap-4">
              <div className="space-y-1 text-center">
                <div className="glass-surface mx-auto flex h-11 w-11 items-center justify-center rounded-full">
                  <KeyIcon className="h-5 w-5 text-brand" />
                </div>
                <h2 className="text-title text-ink-primary">Step 1 — Connect an AI provider</h2>
                <p className="mx-auto max-w-[360px] text-caption text-ink-muted">
                  Impleo needs an AI key to write answers on your behalf. Pick whichever you have —
                  a free-tier Gemini key works fine.
                </p>
              </div>

              <div className="space-y-2 rounded-card border border-surface-border bg-surface-card p-3 shadow-soft-sm">
                <select
                  className={inputClass}
                  value={provider}
                  onChange={(e) => onProviderChange(e.target.value)}
                >
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                      {savedKeyProviders.has(p.id) ? ' ✓ key saved' : ''}
                    </option>
                  ))}
                </select>
                <input
                  type="password"
                  className={inputClass}
                  placeholder={
                    savedKeyProviders.has(provider)
                      ? 'Enter a new key to replace the saved one'
                      : KEY_HINTS[provider] || 'API key'
                  }
                  value={apiKey}
                  onChange={(e) => onApiKeyChange(e.target.value)}
                  autoFocus
                />
                {savedKeyProviders.has(provider) && !apiKey && (
                  <p className="text-caption text-brand">A key is already saved for {providerLabel}.</p>
                )}
                <input
                  className={inputClass}
                  placeholder="Model name (optional — provider default is fine)"
                  value={model}
                  onChange={(e) => onModelChange(e.target.value)}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={onTestKey} disabled={testing} className={secondaryBtn}>
                    {testing ? 'Testing…' : 'Test key'}
                  </button>
                  {keyStatus && (
                    <span className={`min-w-0 break-words text-body ${keyStatus.state === 'error' ? 'text-red-400' : 'text-brand'}`}>
                      {keyStatus.message}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <button type="button" onClick={() => setStep(0)} className={ghostBtn}>
                  Back
                </button>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setStep(2)} className={ghostBtn}>
                    Skip for now
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    disabled={!hasKey}
                    className={primaryBtn}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 2 — Import your profile */}
          {step === 2 && (
            <div className="flex h-full min-h-[420px] flex-col justify-center gap-4 text-center">
              <div className="space-y-1">
                <div className="glass-surface mx-auto flex h-11 w-11 items-center justify-center rounded-full">
                  <UploadIcon className="h-5 w-5 text-brand" />
                </div>
                <h2 className="text-title text-ink-primary">Step 2 — Import your profile</h2>
                <p className="mx-auto max-w-[380px] text-caption text-ink-muted">
                  The fastest way to fill out your profile: paste a prompt into ChatGPT, Claude, or
                  any AI assistant along with your resume — it interviews you and hands back a file
                  you drag straight in.
                </p>
              </div>

              <div className="space-y-2 rounded-card border border-surface-border bg-surface-card p-3 text-left shadow-soft-sm">
                <div className="flex items-center gap-2">
                  <SparkleIcon className="h-4 w-4 shrink-0 text-brand" />
                  <p className="text-body text-ink-primary">Recommended: import from a resume</p>
                </div>
                <p className="text-caption text-ink-muted">
                  On the next screen you'll find a ready-made prompt to copy, plus a drag-and-drop
                  box for the file your AI assistant gives you back.
                </p>
              </div>

              <div className="flex flex-col items-center gap-2">
                <button type="button" onClick={onImportNow} className={`${primaryBtn} w-full max-w-[280px]`}>
                  Import my profile
                </button>
                <button type="button" onClick={onManualSetup} className={ghostBtn}>
                  I'll fill it in manually instead
                </button>
              </div>

              <button type="button" onClick={() => setStep(1)} className={`${ghostBtn} mx-auto`}>
                Back
              </button>
            </div>
          )}
        </div>

        <div className="shrink-0 pb-6 pt-2">
          <StepDots step={step} total={totalSteps} />
        </div>
      </div>
    </div>
  );
}
