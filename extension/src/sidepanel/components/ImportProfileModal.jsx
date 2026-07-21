import { useRef, useState } from 'react';
import { importProfile } from '../lib/importExport.js';

// This prompt is Impleo's onboarding engine for anyone who doesn't want to hand-fill
// the form: it's pasted into an external AI assistant (ChatGPT/Claude/Gemini/Grok/etc.)
// alongside a resume, and the assistant's output is dragged straight back into this
// modal. Impleo never calls a model to generate this itself — see the instructions
// section below for why. Keep this in sync with profileSchema.js's field list if the
// profile shape ever changes.
//
// It is written as a multi-turn INTERVIEW rather than a one-shot extraction. A resume
// alone reliably produces a thin profile: links, identity fields, job-search context and
// per-project impact are usually absent from the document, so a single-pass model leaves
// half the schema as "". Forcing the assistant to audit the resume, then ask in small
// batches, then emit the file only on an explicit go-ahead, is what actually fills those
// fields. The final round is required to be a downloadable .json file — pasted JSON gets
// mangled by chat UIs (smart quotes, truncated long resumeText) and this modal only
// accepts a file.
const IMPORT_PROMPT = `You are my Impleo Profile Interviewer. Impleo is a personal application-assistant tool that auto-fills job and scholarship applications from a structured profile. Your job is NOT to dump JSON immediately — it is to interview me until my profile is genuinely complete, then deliver it as a downloadable file.

Work in four phases. Do not skip ahead. Do not output the final JSON until Phase 4.

=== PHASE 1 — READ AND AUDIT ===
Read the resume/background I give you. Then show me a short audit:
- What you found (name, contact, education, each project, each role, skills).
- A checklist of what is MISSING or WEAK for the schema below, especially: LinkedIn / GitHub / portfolio URLs, projects with no measurable impact, identity fields, and my job-search goals.
Keep this under 20 lines. Then go straight to Phase 2 — don't wait for permission.

=== PHASE 2 — INTERVIEW ME ===
Ask me questions in batches of 5-7, numbered, one batch per message. Wait for my answers before the next batch. Never ask for something the resume already answers. Prioritise in this order:

Batch A — Links and contact: LinkedIn URL, GitHub URL, portfolio/personal site, other public profiles (Kaggle, Behance, Google Scholar, LeetCode, Dribbble, Medium, YouTube). Ask for FULL URLs, not usernames. If I give a username, ask me to confirm the full URL rather than constructing one yourself.
Batch B — Projects: for each project you found, ask what it actually did, the real tech stack, and the concrete outcome (users, latency, revenue, accuracy, downloads, marks, rank). If there is no number, ask what changed because it existed.
Batch C — Experience gaps: unexplained date gaps, unclear job titles, whether roles were internships/freelance/full-time, team size, what I personally owned versus what the team did.
Batch D — Goals and preferences: what roles I'm targeting, industries, location or remote preference, notice period, current and expected compensation, work mode.
Batch E — Identity fields commonly asked on application forms (see identityMemory keys below). Tell me plainly I can skip any of these, and that government ID numbers stay on my own machine.
Batch F — Achievements and writing: awards, publications, competition results, certifications, and whether I have a past essay / cover letter / SOP I can paste as a writing sample.

Rules for this phase:
- I am allowed to answer "skip" or "n/a" to anything. Accept it, don't re-ask.
- If an answer is vague ("improved performance"), ask ONE follow-up for the specific number, then move on.
- Track what is still blank and tell me at the end of each batch roughly how much is left.

=== PHASE 3 — CONFIRM ===
When the batches are done, show me a plain-language summary of the profile you assembled: every link, every project with its impact line, skills list, goals paragraph, and which identity fields you have. Ask me to correct anything. Do not build the file yet.

=== PHASE 4 — DELIVER THE FILE ===
Only after I confirm, produce the profile as a DOWNLOADABLE FILE named impleo-profile.json — create an actual downloadable/attachable .json file, not chat text. Say one short line ("Here's your Impleo profile — download it and drag it into the Import box") and nothing else. Do not print the JSON in the chat, do not summarise it again. If and only if you genuinely cannot produce a downloadable file, say so, then output the raw JSON in a single code block and tell me to save it as impleo-profile.json.

OUTPUT FORMAT — the file must match this shape exactly:

{
  "schemaVersion": 1,
  "app": "impleo",
  "profile": {
    "personal": { "name": "", "email": "", "phone": "", "location": "" },
    "links": { "linkedin": "", "github": "", "portfolio": "" },
    "education": "",
    "skills": [],
    "interests": [],
    "goals": "",
    "projects": [
      { "name": "", "description": "", "techStack": "", "impact": "" }
    ],
    "achievements": [],
    "resumeText": "",
    "writingSampleText": ""
  },
  "qaHistory": [],
  "identityMemory": {},
  "learnedAnswers": []
}

FIELD GUIDE
- personal.name/email/phone/location: exactly as I gave them. Leave "" if I never provided it — never invent contact info.
- links: full URLs including https://. linkedin, github and portfolio are the only three keys — put any extra public profile (Kaggle, Scholar, Behance, Medium…) in portfolio if it's my main one, and mention the rest inside resumeText so nothing is lost.
- education: one line per degree/program (e.g. "BS Computer Science, XYZ University, 2024" — include GPA/percentage if I gave it); join multiple with \\n inside the string.
- skills / interests: arrays of short strings. Only skills actually stated or clearly demonstrated by real work — no buzzword padding.
- goals: 2-4 sentences, first person, built from my Batch D answers — target roles, industries, location/remote preference, what I'm optimising for.
- projects: one object per real project. techStack is a short string (e.g. "React, Node.js, PostgreSQL"). impact is the concrete outcome I gave you in Batch B; if I truly had none, describe what it does — never invent a number.
- achievements: array of short strings — awards, publications, competition results, certifications, notable metrics. Only real ones.
- resumeText: the FULL plain-text content of my resume, cleaned up (no repeated page headers/footers/page numbers), plus any extra context I gave you during the interview that has no dedicated field (extra profile links, notice period, compensation notes, role preferences). This is the most important field — never summarise or truncate it, however long it is.
- writingSampleText: my past essay / cover letter / SOP verbatim if I gave one. Otherwise "".
- qaHistory: always [].
- learnedAnswers: always [].
- identityMemory: flat object of reusable identity values, ONLY where I actually gave a value. Use exactly these snake_case keys: full_name, father_name, mother_name, date_of_birth (YYYY-MM-DD), gender, nationality, marital_status, religion, category, phone, email, address, city, state, district, pincode, country, aadhaar_number, pan_number, passport_number, current_ctc, expected_ctc, notice_period_days, work_mode. Omit any key I skipped — never guess an ID number, a salary, or a date of birth. {} if none apply.

HARD RULES
1. Never hallucinate work experience, job titles, employers, dates, or degrees I didn't give you.
2. Never invent achievements, metrics, awards, or outcomes.
3. A field with no source stays "" (or [] / omitted) — no plausible-sounding placeholders.
4. Conservative inference is fine (reading "distributed systems" as a skill from a project that clearly involved it); anything beyond a fair reading is not.
5. The file must be valid JSON — real double quotes, no trailing commas, no comments, no markdown inside it.
6. Ask before you assume. If you are unsure whether something belongs in the profile, that is a question for Phase 2, not a guess in Phase 4.

Start with Phase 1 now. Here is my resume and background:
[paste your resume and any other context below this line]`;

function UploadIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 16V4M12 4l-4 4M12 4l4 4" />
      <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

function CloseIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

const secondaryBtn =
  'rounded-btn border border-surface-border bg-surface-card-hover px-3 py-1 text-body text-ink-primary transition-colors duration-150 hover:bg-surface-border disabled:opacity-50';
const primaryBtn =
  'rounded-btn bg-brand px-3 py-1 text-body font-medium text-jungle transition-colors duration-150 hover:bg-brand-hover disabled:opacity-50';
const errorBanner =
  'min-w-0 break-words rounded-card border border-red-900/50 bg-red-950/30 p-2.5 text-body text-red-300';

export default function ImportProfileModal({ open, onClose, currentProfile, onImported }) {
  const fileInputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(null); // { envelope, summary } once dry-run validates
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  function reset() {
    setError(null);
    setPending(null);
    setDragActive(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function processFile(file) {
    if (!file) return;
    setError(null);
    setPending(null);

    let parsed;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      setError("That file isn't valid JSON.");
      return;
    }

    setBusy(true);
    try {
      const result = await importProfile(parsed, { dryRun: true });
      setPending({ envelope: parsed, summary: result.summary });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragActive(false);
    processFile(e.dataTransfer.files?.[0]);
  }

  function handleBrowse(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    processFile(file);
  }

  async function handleConfirm() {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      await importProfile(pending.envelope);
      onImported();
      handleClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleCopyPrompt() {
    try {
      await navigator.clipboard.writeText(IMPORT_PROMPT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy automatically — select the text above and copy it manually.');
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-surface-bg"
      role="dialog"
      aria-modal="true"
      aria-label="Import profile"
      onKeyDown={(e) => {
        if (e.key === 'Escape') handleClose();
      }}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-surface-border bg-surface-sidebar px-3 py-3 sm:px-4">
        <h2 className="text-title text-ink-primary">Import profile</h2>
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close"
          className="rounded-btn p-1.5 text-ink-secondary transition-colors duration-150 hover:bg-surface-card-hover hover:text-ink-primary"
        >
          <CloseIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-3 sm:p-4">
        {/* Section 1 — upload area / confirm step */}
        {pending ? (
          <div className={`${errorBanner} space-y-2`}>
            <p>
              This will replace your current profile
              {currentProfile?.personal?.name ? ` (currently: ${currentProfile.personal.name})` : ''}{' '}
              with the imported one
              {pending.summary?.name ? ` for ${pending.summary.name}` : ''}, and replace your
              saved Q&A history with {pending.summary?.qaHistoryCount ?? 0} imported entries.
              This can't be undone.
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setPending(null)} disabled={busy} className={secondaryBtn}>
                Cancel
              </button>
              <button type="button" onClick={handleConfirm} disabled={busy} className={primaryBtn}>
                {busy ? 'Importing…' : 'Replace profile'}
              </button>
            </div>
          </div>
        ) : (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
            }}
            role="button"
            tabIndex={0}
            aria-label="Upload profile JSON file"
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed p-8 text-center transition-colors duration-150 ${
              dragActive ? 'border-brand bg-brand/5' : 'border-surface-border bg-surface-card hover:bg-surface-card-hover'
            }`}
          >
            <UploadIcon className="h-8 w-8 text-ink-secondary" />
            <p className="text-card text-ink-primary">
              {busy ? 'Reading file…' : 'Drag & drop your profile JSON here'}
            </p>
            <p className="text-caption text-ink-muted">or click to browse — .json files only</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={handleBrowse}
            />
          </div>
        )}

        {error && <div className={errorBanner}>{error}</div>}

        {/* Section 2 — instructions */}
        <div className="space-y-2 rounded-card border border-surface-border bg-surface-card p-3 shadow-soft-sm">
          <h3 className="text-card text-ink-primary">Don't have a profile JSON yet?</h3>
          <ol className="list-decimal space-y-1 pl-4 text-body text-ink-secondary">
            <li>Open ChatGPT, Claude, Gemini, Grok, or any AI assistant.</li>
            <li>Copy the prompt below and paste it in, with your resume attached.</li>
            <li>Answer its questions — it interviews you in a few short rounds to fill in the things a resume leaves out (links, project impact, goals, form fields).</li>
            <li>Confirm the summary it shows you.</li>
            <li>Download the <code>impleo-profile.json</code> file it gives you.</li>
            <li>Drag and drop it into the box above.</li>
          </ol>
          <p className="text-caption text-ink-muted">
            Impleo doesn't generate this file itself — your AI assistant does, from the prompt
            below. Impleo only imports and validates the result. That keeps Impleo
            provider-agnostic, avoids API costs, and works with any AI model you already have
            access to.
          </p>
        </div>

        {/* Section 3 — copy prompt */}
        <div className="space-y-2 rounded-card border border-surface-border bg-surface-card p-3 shadow-soft-sm">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-card text-ink-primary">Prompt for your AI assistant</h3>
            <button type="button" onClick={handleCopyPrompt} className={`shrink-0 ${secondaryBtn}`}>
              {copied ? 'Copied ✓' : 'Copy prompt'}
            </button>
          </div>
          <textarea
            readOnly
            rows={12}
            value={IMPORT_PROMPT}
            onFocus={(e) => e.target.select()}
            className="w-full resize-none rounded-input border border-surface-border bg-surface-bg px-2.5 py-1.5 font-mono text-caption text-ink-secondary focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </div>
      </div>
    </div>
  );
}
