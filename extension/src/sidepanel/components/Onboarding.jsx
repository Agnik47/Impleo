import { useState } from 'react';
import { api } from '../lib/api.js';
import ImportProfileModal from './ImportProfileModal.jsx';

const emptyForm = {
  personal: { name: '', email: '', phone: '', location: '' },
  links: { linkedin: '', github: '', portfolio: '' },
  education: '',
  skills: '',
  interests: '',
  goals: '',
  projects: '',
  achievements: '',
  resumeText: '',
  writingSampleText: '',
};

function profileToFormState(profile) {
  if (!profile) return emptyForm;
  return {
    personal: { ...emptyForm.personal, ...profile.personal },
    links: { ...emptyForm.links, ...profile.links },
    education: profile.education ?? '',
    skills: (profile.skills ?? []).join(', '),
    interests: (profile.interests ?? []).join(', '),
    goals: profile.goals ?? '',
    projects: (profile.projects ?? [])
      .map((p) => [p.name, p.description, p.techStack, p.impact].join(' | '))
      .join('\n'),
    achievements: (profile.achievements ?? []).join('\n'),
    resumeText: profile.resumeText ?? '',
    writingSampleText: profile.writingSampleText ?? '',
  };
}

function formStateToProfile(form) {
  return {
    personal: form.personal,
    links: form.links,
    education: form.education,
    skills: form.skills.split(',').map((s) => s.trim()).filter(Boolean),
    interests: form.interests.split(',').map((s) => s.trim()).filter(Boolean),
    goals: form.goals,
    projects: form.projects
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [name = '', description = '', techStack = '', impact = ''] = line
          .split('|')
          .map((s) => s.trim());
        return { name, description, techStack, impact };
      }),
    achievements: form.achievements.split('\n').map((s) => s.trim()).filter(Boolean),
    resumeText: form.resumeText,
    writingSampleText: form.writingSampleText,
  };
}

function Section({ label, hint, children }) {
  return (
    <section className="min-w-0 space-y-2 rounded-card border border-surface-border bg-surface-card p-3 shadow-soft-sm">
      <h2 className="break-words text-card text-ink-primary">{label}</h2>
      {hint && <p className="break-words text-caption text-ink-muted">{hint}</p>}
      {children}
    </section>
  );
}

function Field({ label, children }) {
  return (
    <section className="min-w-0 space-y-1.5 rounded-card border border-surface-border bg-surface-card p-3 shadow-soft-sm">
      <h2 className="break-words text-card text-ink-primary">{label}</h2>
      {children}
    </section>
  );
}

const inputClass =
  'w-full rounded-input border border-surface-border bg-surface-bg px-2.5 py-1.5 text-body text-ink-primary placeholder:text-ink-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand transition-colors duration-150';

// Per-provider hints for the key input placeholder — just a nudge on what a
// given vendor's key looks like, not validation.
const KEY_HINTS = {
  anthropic: 'sk-ant-...',
  gemini: 'AIza... (or another Google AI Studio key format)',
  openai: 'sk-...',
  groq: 'gsk_...',
};

export default function Onboarding({ initialProfile, initialSettings, onSaved }) {
  const [form, setForm] = useState(() => profileToFormState(initialProfile));

  const providers = initialSettings?.providers ?? [];
  const savedKeyProviders = new Set(providers.filter((p) => p.hasKey).map((p) => p.id));
  const [provider, setProvider] = useState(
    initialSettings?.provider || providers[0]?.id || 'anthropic'
  );

  function modelFor(providerId) {
    const p = providers.find((x) => x.id === providerId);
    return p?.model || p?.defaultModel || '';
  }

  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(() => modelFor(provider));
  const [keyStatus, setKeyStatus] = useState(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // Profile backup. Export stays inline (a single click, no confirmation needed —
  // it's non-destructive). Import opens ImportProfileModal, which owns its own
  // upload/validate/confirm state; it just calls onImported (== onSaved) when done.
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const busy = saving || exporting;

  const providerLabel = providers.find((p) => p.id === provider)?.label || provider;

  async function handleExport() {
    setExporting(true);
    setExportError(null);
    try {
      const envelope = await api.exportProfile();
      const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `impleo-profile-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err.message);
    } finally {
      setExporting(false);
    }
  }

  function updateField(section, field, value) {
    setForm((prev) =>
      section
        ? { ...prev, [section]: { ...prev[section], [field]: value } }
        : { ...prev, [field]: value }
    );
  }

  // Switching provider clears any stale "key works" result and loads that
  // provider's own saved (or suggested) model instead of carrying over the
  // previous provider's model string.
  function handleProviderChange(nextProvider) {
    setProvider(nextProvider);
    setApiKey('');
    setModel(modelFor(nextProvider));
    setKeyStatus(null);
  }

  async function handleTestKey() {
    if (!apiKey) {
      setKeyStatus({ state: 'error', message: 'Paste a key first.' });
      return;
    }
    setTesting(true);
    setKeyStatus(null);
    try {
      const result = await api.testApiKey(provider, apiKey, model || undefined);
      setKeyStatus(
        result.ok
          ? { state: 'ok', message: 'Key works.' }
          : { state: 'error', message: result.error || 'Key test failed.' }
      );
    } catch (err) {
      setKeyStatus({ state: 'error', message: err.message });
    } finally {
      setTesting(false);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!apiKey && !savedKeyProviders.has(provider)) {
      setSaveError(`Enter an API key for ${providerLabel}, or pick a provider you've already saved a key for.`);
      return;
    }
    setSaving(true);
    setSaveError(null);

    // Always save settings so the active provider is persisted, even when the
    // key field is blank (switching to an already-saved provider).
    const tasks = [
      { label: 'profile', run: () => api.saveProfile(formStateToProfile(form)) },
      {
        label: 'provider settings',
        run: () => api.saveSettings(provider, apiKey || undefined, model || undefined),
      },
    ];
    const results = await Promise.allSettled(tasks.map((t) => t.run()));
    setSaving(false);

    const failures = results
      .map((r, i) => (r.status === 'rejected' ? `${tasks[i].label} (${r.reason.message})` : null))
      .filter(Boolean);

    if (failures.length > 0) {
      setSaveError(
        `Failed to save: ${failures.join(', ')}. Anything not listed here saved fine — fix the error and save again.`
      );
      return;
    }
    onSaved();
  }

  return (
    <form onSubmit={handleSave} className="mx-auto w-full max-w-[500px] space-y-3 p-3 sm:p-4">
      <div className="flex min-w-0 items-center gap-2 pb-1">
        <img src="./icons/icon-32.png" alt="" className="h-6 w-6 shrink-0" />
        <h1 className="truncate text-title text-ink-primary">Set up your profile</h1>
      </div>

      <Section label="Backup" hint="Export a copy of your profile and saved Q&A, or import one from a file.">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            disabled={!initialProfile || busy}
            className="shrink-0 rounded-btn border border-surface-border bg-surface-card-hover px-3 py-1 text-body text-ink-primary transition-colors duration-150 hover:bg-surface-border disabled:opacity-50"
          >
            {exporting ? 'Exporting…' : 'Export profile'}
          </button>
          <button
            type="button"
            onClick={() => setImportModalOpen(true)}
            disabled={busy}
            className="shrink-0 rounded-btn border border-surface-border bg-surface-card-hover px-3 py-1 text-body text-ink-primary transition-colors duration-150 hover:bg-surface-border disabled:opacity-50"
          >
            Import profile
          </button>
        </div>
        <p className="text-caption text-ink-muted">
          Exported files contain your profile in plain text, including personal info — handle
          them like a resume.
        </p>

        {exportError && (
          <div className="min-w-0 break-words rounded-card border border-red-900/50 bg-red-950/30 p-2.5 text-body text-red-300">
            {exportError}
          </div>
        )}
      </Section>

      <Section label="AI provider" hint="Pick which provider to use — you only need a key for this one. Use whichever you have free-tier access to (e.g. a free Google Gemini key works if you don't want to pay for API usage).">
        <select
          className={inputClass}
          value={provider}
          onChange={(e) => handleProviderChange(e.target.value)}
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
          onChange={(e) => setApiKey(e.target.value)}
        />
        {savedKeyProviders.has(provider) && !apiKey && (
          <p className="text-caption text-brand">A key is already saved for {providerLabel}.</p>
        )}
        <input
          className={inputClass}
          placeholder="Model name (e.g. a free-tier model from your provider's docs)"
          value={model}
          onChange={(e) => setModel(e.target.value)}
        />
        <p className="text-caption text-ink-muted">
          Any model id your {providerLabel} account has access to — check your
          provider's pricing/docs page for which models are free-tier. This is
          only a suggested starting point, not enforced.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleTestKey}
            disabled={testing}
            className="shrink-0 rounded-btn border border-surface-border bg-surface-card-hover px-3 py-1 text-body text-ink-primary transition-colors duration-150 hover:bg-surface-border disabled:opacity-50"
          >
            {testing ? 'Testing…' : 'Test key'}
          </button>
          {keyStatus && (
            <span className={`min-w-0 break-words text-body ${keyStatus.state === 'error' ? 'text-red-400' : 'text-brand'}`}>
              {keyStatus.message}
            </span>
          )}
        </div>
      </Section>

      <Section label="Personal info">
        <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
          <input
            className={inputClass}
            placeholder="Name"
            value={form.personal.name}
            onChange={(e) => updateField('personal', 'name', e.target.value)}
          />
          <input
            className={inputClass}
            placeholder="Email"
            value={form.personal.email}
            onChange={(e) => updateField('personal', 'email', e.target.value)}
          />
          <input
            className={inputClass}
            placeholder="Phone"
            value={form.personal.phone}
            onChange={(e) => updateField('personal', 'phone', e.target.value)}
          />
          <input
            className={inputClass}
            placeholder="Location"
            value={form.personal.location}
            onChange={(e) => updateField('personal', 'location', e.target.value)}
          />
        </div>
      </Section>

      <Section label="Links">
        <input
          className={inputClass}
          placeholder="LinkedIn URL"
          value={form.links.linkedin}
          onChange={(e) => updateField('links', 'linkedin', e.target.value)}
        />
        <input
          className={inputClass}
          placeholder="GitHub URL"
          value={form.links.github}
          onChange={(e) => updateField('links', 'github', e.target.value)}
        />
        <input
          className={inputClass}
          placeholder="Portfolio URL"
          value={form.links.portfolio}
          onChange={(e) => updateField('links', 'portfolio', e.target.value)}
        />
      </Section>

      <Field label="Education (one entry per line)">
        <textarea
          rows={3}
          className={inputClass}
          value={form.education}
          onChange={(e) => updateField(null, 'education', e.target.value)}
        />
      </Field>

      <Field label="Skills (comma-separated)">
        <input
          className={inputClass}
          value={form.skills}
          onChange={(e) => updateField(null, 'skills', e.target.value)}
        />
      </Field>

      <Field label="Interests (comma-separated)">
        <input
          className={inputClass}
          value={form.interests}
          onChange={(e) => updateField(null, 'interests', e.target.value)}
        />
      </Field>

      <Field label="Goals">
        <textarea
          rows={3}
          className={inputClass}
          value={form.goals}
          onChange={(e) => updateField(null, 'goals', e.target.value)}
        />
      </Field>

      <Field label="Projects (one per line: name | description | tech stack | impact)">
        <textarea
          rows={4}
          className={inputClass}
          value={form.projects}
          onChange={(e) => updateField(null, 'projects', e.target.value)}
        />
        <p className="text-caption text-ink-muted">
          Don't use "|" inside a field's own text — it's the column separator.
        </p>
      </Field>

      <Field label="Achievements (one per line)">
        <textarea
          rows={3}
          className={inputClass}
          value={form.achievements}
          onChange={(e) => updateField(null, 'achievements', e.target.value)}
        />
      </Field>

      <Field label="Resume text (pasted)">
        <textarea
          rows={6}
          className={inputClass}
          value={form.resumeText}
          onChange={(e) => updateField(null, 'resumeText', e.target.value)}
        />
      </Field>

      <Field label="Writing sample (1-2 past answers/essays)">
        <textarea
          rows={6}
          className={inputClass}
          value={form.writingSampleText}
          onChange={(e) => updateField(null, 'writingSampleText', e.target.value)}
        />
      </Field>

      {saveError && (
        <div className="min-w-0 break-words rounded-card border border-red-900/50 bg-red-950/30 p-2.5 text-body text-red-300">
          {saveError}
        </div>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-btn bg-brand px-3 py-2 text-body font-medium text-jungle shadow-soft-sm transition-colors duration-150 hover:bg-brand-hover disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save profile'}
      </button>

      <ImportProfileModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        currentProfile={initialProfile}
        onImported={onSaved}
      />
    </form>
  );
}
