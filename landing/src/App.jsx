import { useState } from 'react';
import {
  Container,
  Section,
  Eyebrow,
  PrimaryButton,
  GhostButton,
  Card,
  Reveal,
  Icon,
} from './ui.jsx';
import ReviewCardMock from './ReviewCardMock.jsx';

const CHROME_STORE_URL = '#'; // TODO: replace with real Chrome Web Store listing (see LANDING_PAGE.md §11)
const GITHUB_URL = '#'; // TODO: replace with real repo URL

const TRUST_TRIAD = 'Bring your own key · Runs locally · Never auto-submits';

/* ============================ NAV ============================ */
function Nav() {
  const [open, setOpen] = useState(false);
  const links = [
    ['How it works', '#how'],
    ['Features', '#features'],
    ['Privacy', '#privacy'],
    ['FAQ', '#faq'],
  ];
  return (
    <header className="sticky top-0 z-50 border-b border-surface-border bg-surface-bg/80 backdrop-blur-md">
      <Container className="flex h-16 items-center justify-between">
        <a href="#top" className="flex items-center gap-2">
          <img src="/chameleon.png" alt="" className="h-7 w-7" />
          <span className="text-[18px] font-semibold tracking-tight text-ink-primary">
            Impleo
          </span>
        </a>

        <nav className="hidden items-center gap-8 md:flex">
          {links.map(([label, href]) => (
            <a
              key={href}
              href={href}
              className="text-[14px] font-medium text-ink-secondary transition duration-150 hover:text-ink-primary"
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <a
            href={GITHUB_URL}
            className="text-[14px] font-medium text-ink-secondary transition duration-150 hover:text-ink-primary"
          >
            GitHub
          </a>
          <PrimaryButton href={CHROME_STORE_URL} className="px-4 py-2 text-[14px]">
            Add to Chrome
          </PrimaryButton>
        </div>

        <button
          type="button"
          aria-label="Toggle menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="rounded-btn border border-surface-border p-2 text-ink-primary md:hidden"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="1.8" strokeLinecap="round">
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </Container>

      {open && (
        <div className="border-t border-surface-border bg-surface-sidebar md:hidden">
          <Container className="flex flex-col gap-1 py-4">
            {links.map(([label, href]) => (
              <a
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="rounded-btn px-2 py-2 text-[15px] text-ink-secondary hover:bg-surface-card-hover hover:text-ink-primary"
              >
                {label}
              </a>
            ))}
            <PrimaryButton href={CHROME_STORE_URL} className="mt-2">
              Add to Chrome — Free
            </PrimaryButton>
          </Container>
        </div>
      )}
    </header>
  );
}

/* ============================ HERO ============================ */
function Hero() {
  return (
    <div id="top" className="relative overflow-hidden">
      {/* soft lime glow behind the mascot */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 top-10 h-[520px] w-[520px] rounded-full bg-lime/10 blur-3xl"
      />
      <Container className="relative grid grid-cols-1 items-center gap-12 py-20 md:py-28 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <Eyebrow className="mb-4">AI autofill, but you stay in control</Eyebrow>
          <h1 className="text-[40px] font-bold leading-[1.05] tracking-tight text-ink-primary sm:text-[52px] lg:text-[62px]">
            Fill any application form in{' '}
            <span className="chameleon-text">under 30 seconds.</span>
          </h1>
          <p className="mt-6 max-w-xl text-[18px] leading-relaxed text-ink-secondary">
            Impleo reads the form, writes personalized answers in <em>your</em> voice,
            and lets you review every one before a single field is touched. Hackathons,
            fellowships, scholarships — done.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <PrimaryButton href={CHROME_STORE_URL}>Add to Chrome — Free</PrimaryButton>
            <GhostButton href="#how">See how it works</GhostButton>
          </div>
          <p className="mt-5 text-[13px] text-ink-muted">{TRUST_TRIAD}</p>
        </div>

        <div className="lg:col-span-5">
          <Reveal className="relative" delay={120}>
            <img
              src="/chameleon.png"
              alt=""
              className="absolute -top-14 right-2 z-10 h-24 w-24 drop-shadow-[0_10px_30px_rgba(166,217,26,0.35)]"
            />
            <ReviewCardMock />
          </Reveal>
        </div>
      </Container>
    </div>
  );
}

/* ==================== SOCIAL PROOF STRIP ==================== */
function WorksOn() {
  const items = ['Google Forms', 'Luma', 'Generic HTML forms'];
  return (
    <div className="border-y border-surface-border bg-surface-bg">
      <Container className="flex flex-col items-center gap-4 py-8 sm:flex-row sm:justify-center sm:gap-10">
        <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
          Works on
        </span>
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2">
          {items.map((it) => (
            <span key={it} className="text-[15px] font-medium text-ink-secondary">
              {it}
            </span>
          ))}
        </div>
      </Container>
    </div>
  );
}

/* ============================ PROBLEM ============================ */
function Problem() {
  return (
    <Section>
      <Container className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
        <Reveal>
          <Eyebrow className="mb-4">The real time sink</Eyebrow>
          <h2 className="text-[32px] font-semibold leading-tight text-ink-primary md:text-[40px]">
            The mechanical fields are easy. The essays are the time sink.
          </h2>
          <p className="mt-5 text-[17px] leading-relaxed text-ink-secondary">
            Name and email take seconds. But “why do you want to attend,” “tell us about
            yourself,” “describe your project” — those mean digging through your resume,
            LinkedIn, and GitHub, prompting ChatGPT, then hand-copying it all back into
            the form. <span className="text-ink-primary">30–45 minutes per application,</span>{' '}
            several times a month.
          </p>
        </Reveal>

        <Reveal delay={100}>
          <Card className="flex items-center justify-center gap-6 p-10">
            <div className="text-center">
              <p className="font-mono text-[40px] font-bold text-ink-muted line-through decoration-ink-muted/40">
                45:00
              </p>
              <p className="mt-1 text-[13px] text-ink-muted">by hand</p>
            </div>
            <Icon name="arrow" className="h-8 w-8 text-brand" />
            <div className="text-center">
              <p className="font-mono text-[40px] font-bold text-brand">0:30</p>
              <p className="mt-1 text-[13px] text-ink-secondary">with Impleo</p>
            </div>
          </Card>
        </Reveal>
      </Container>
    </Section>
  );
}

/* ========================= HOW IT WORKS ========================= */
function HowItWorks() {
  const steps = [
    ['detect', 'Detect', 'Open the side panel on any form page.'],
    ['form', 'Extract', 'Impleo reads every question and field type.'],
    ['model', 'Generate', 'Personalized answers in your voice — one AI call.'],
    ['review', 'Review', 'Accept · Edit · Regenerate · Skip — every answer.'],
    ['fill', 'Fill', 'Only approved answers are written. Submit is never touched.'],
  ];
  return (
    <Section id="how" className="border-t border-surface-border">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <Eyebrow className="mb-4">How it works</Eyebrow>
          <h2 className="text-[32px] font-semibold leading-tight text-ink-primary md:text-[40px]">
            Five steps, and the chameleon adapts to each form.
          </h2>
        </div>

        <div className="relative mt-14">
          {/* connector line (chameleon shift, low opacity) — desktop only */}
          <div
            aria-hidden="true"
            className="chameleon-line absolute left-0 right-0 top-6 hidden h-px opacity-30 lg:block"
          />
          <ol className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {steps.map(([icon, title, body], i) => (
              <Reveal key={title} delay={i * 60}>
                <li className="relative">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-surface-border bg-surface-card text-brand shadow-glow">
                    <Icon name={icon} className="h-5 w-5" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-[13px] font-semibold text-lime">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <h3 className="text-[16px] font-semibold text-ink-primary">{title}</h3>
                  </div>
                  <p className="mt-2 text-[14px] leading-relaxed text-ink-secondary">
                    {body}
                  </p>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </Container>
    </Section>
  );
}

/* ========================== FEATURES ========================== */
function Features() {
  const features = [
    ['voice', 'Answers in your voice', 'Learns tone from your writing sample and past answers — no robotic filler.'],
    ['review', 'Human review, always', 'Nothing is written until you approve. Accept, edit, regenerate, or skip each one.'],
    ['options', 'Radios, checkboxes, dropdowns', 'Not just text fields — it picks the right option from the real choices.'],
    ['form', 'Google Forms & Luma native', 'First-class extractors for the platforms you actually apply through.'],
    ['model', 'Bring your own model', 'Anthropic, Gemini, OpenAI, or Groq — your key, your choice.'],
    ['lock', 'Never auto-submits', 'A hard product rule. Impleo fills — you press submit.'],
  ];
  return (
    <Section id="features" className="border-t border-surface-border">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <Eyebrow className="mb-4">Features</Eyebrow>
          <h2 className="text-[32px] font-semibold leading-tight text-ink-primary md:text-[40px]">
            Built to feel premium — and to keep you in control.
          </h2>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(([icon, title, body], i) => (
            <Reveal key={title} delay={(i % 3) * 60}>
              <Card className="h-full p-6 hover:-translate-y-0.5 hover:bg-surface-card-hover">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-input bg-jungle text-lime">
                  <Icon name={icon} className="h-5 w-5" />
                </div>
                <h3 className="text-[16px] font-semibold text-ink-primary">{title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-ink-secondary">{body}</p>
              </Card>
            </Reveal>
          ))}
        </div>
      </Container>
    </Section>
  );
}

/* ====================== REVIEW-FIRST / TRUST ====================== */
function ReviewTrust() {
  return (
    <div className="bg-jungle">
      <Section>
        <Container className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <Eyebrow className="mb-4">You stay in control</Eyebrow>
            <h2 className="text-[32px] font-semibold leading-tight text-ink-primary md:text-[40px]">
              AI writes the draft. You own the decision.
            </h2>
            <p className="mt-5 text-[17px] leading-relaxed text-ink-secondary">
              Every generated answer lands in a review card with a confidence badge and
              four actions. Nothing reaches the page until you say so — and the submit
              button is never touched, by design.
            </p>
            <ul className="mt-6 space-y-3">
              {['Accept as-is', 'Edit inline', 'Regenerate with an instruction', 'Skip entirely'].map(
                (t) => (
                  <li key={t} className="flex items-center gap-3 text-[15px] text-ink-primary">
                    <span className="text-signature">
                      <Icon name="check" className="h-5 w-5" />
                    </span>
                    {t}
                  </li>
                )
              )}
            </ul>
          </Reveal>

          <Reveal delay={100}>
            <ReviewCardMock
              question="Describe a project you're proud of."
              answer="I built an AI autofill copilot that reads application forms and drafts answers in the applicant's own voice — with a mandatory review step so nothing is submitted without a human approving it. It cut my own application time from ~40 minutes to under one."
              confidence="medium"
              autoAccept={false}
            />
          </Reveal>
        </Container>
      </Section>
    </div>
  );
}

/* ========================= MULTI-PROVIDER ========================= */
function Providers() {
  const providers = ['Anthropic', 'Google Gemini', 'OpenAI', 'Groq'];
  return (
    <Section className="border-t border-surface-border">
      <Container className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
        <Reveal>
          <Eyebrow className="mb-4">Multi-model</Eyebrow>
          <h2 className="text-[32px] font-semibold leading-tight text-ink-primary md:text-[40px]">
            One active model at a time. Your key, never ours.
          </h2>
          <p className="mt-5 text-[17px] leading-relaxed text-ink-secondary">
            Pick your provider and paste your own key. Impleo routes every call through a
            local server — the key never leaves your machine and is never sent to the
            browser.
          </p>
        </Reveal>

        <Reveal delay={100}>
          <div className="grid grid-cols-2 gap-4">
            {providers.map((p, i) => (
              <Card
                key={p}
                className={`flex items-center justify-center p-6 text-[15px] font-semibold ${
                  i === 0
                    ? 'text-ink-primary ring-1 ring-brand'
                    : 'text-ink-secondary'
                }`}
              >
                {p}
                {i === 0 && (
                  <span className="ml-2 rounded-full bg-brand/15 px-2 py-0.5 text-[11px] font-semibold text-brand">
                    active
                  </span>
                )}
              </Card>
            ))}
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}

/* ============================ PRIVACY ============================ */
function Privacy() {
  const pledges = [
    'Runs on your machine — a local server, not our cloud.',
    'Your profile and keys live in a local database, single-user.',
    'Your data is only ever sent to the model provider you chose.',
  ];
  return (
    <Section id="privacy" className="border-t border-surface-border">
      <Container className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
        <Reveal>
          <Eyebrow className="mb-4">Private by design</Eyebrow>
          <h2 className="text-[32px] font-semibold leading-tight text-ink-primary md:text-[40px]">
            Local-first. No hosted server, no middleman.
          </h2>
          <ul className="mt-6 space-y-4">
            {pledges.map((t) => (
              <li key={t} className="flex items-start gap-3 text-[16px] text-ink-primary">
                <span className="mt-0.5 text-signature">
                  <Icon name="check" className="h-5 w-5" />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={100}>
          <Card className="p-8">
            <div className="flex flex-col items-stretch gap-3 text-center text-[14px] font-medium">
              {['Your browser', 'localhost server', 'Your chosen provider'].map((node, i) => (
                <div key={node} className="flex flex-col items-center gap-3">
                  <div className="w-full rounded-input border border-surface-border bg-surface-bg px-4 py-3 text-ink-primary">
                    {node}
                  </div>
                  {i < 2 && (
                    <span className="text-brand">
                      <Icon name="arrow" className="h-5 w-5 rotate-90" />
                    </span>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-4 text-center text-[13px] text-ink-muted">
              No third-party cloud in the path.
            </p>
          </Card>
        </Reveal>
      </Container>
    </Section>
  );
}

/* ============================== FAQ ============================== */
function FAQ() {
  const qa = [
    ['Does Impleo submit forms for me?', 'No. Never. You always press submit yourself — it is a hard product rule with no code path that clicks a submit button.'],
    ['Do I need my own API key?', 'Yes — bring a key from any supported provider (Anthropic, Gemini, OpenAI, or Groq). You only pay that provider’s usage.'],
    ['Where is my data stored?', 'Locally, on your machine, in a single-user database owned by a local server. Nothing is hosted or shared.'],
    ['Which forms are supported?', 'Google Forms and Luma natively, plus generic HTML forms — including radios, checkboxes, and dropdowns.'],
    ['Is it free?', 'The extension is free. Your only cost is whatever your chosen model provider charges for the calls you make.'],
  ];
  const [open, setOpen] = useState(0);
  return (
    <Section id="faq" className="border-t border-surface-border">
      <Container className="max-w-[720px]">
        <div className="text-center">
          <Eyebrow className="mb-4">FAQ</Eyebrow>
          <h2 className="text-[32px] font-semibold leading-tight text-ink-primary md:text-[40px]">
            Questions, answered.
          </h2>
        </div>

        <div className="mt-10 divide-y divide-surface-border border-y border-surface-border">
          {qa.map(([q, a], i) => {
            const isOpen = open === i;
            return (
              <div key={q}>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? -1 : i)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-4 py-5 text-left"
                >
                  <span className="text-[16px] font-medium text-ink-primary">{q}</span>
                  <span
                    className={`shrink-0 text-ink-secondary transition-transform duration-200 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  >
                    <Icon name="chevron" className="h-5 w-5" />
                  </span>
                </button>
                {isOpen && (
                  <p className="pb-5 text-[15px] leading-relaxed text-ink-secondary">{a}</p>
                )}
              </div>
            );
          })}
        </div>
      </Container>
    </Section>
  );
}

/* =========================== FINAL CTA =========================== */
function FinalCTA() {
  return (
    <Section className="border-t border-surface-border">
      <Container>
        <div className="relative overflow-hidden rounded-card border border-surface-border bg-surface-card px-6 py-16 text-center">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 rounded-full bg-lime/15 blur-3xl"
          />
          <img
            src="/chameleon.png"
            alt=""
            className="relative mx-auto mb-6 h-16 w-16 drop-shadow-[0_10px_30px_rgba(166,217,26,0.35)]"
          />
          <h2 className="relative text-[32px] font-bold leading-tight text-ink-primary md:text-[40px]">
            Stop hand-copying essays. Start applying.
          </h2>
          <div className="relative mt-8 flex flex-wrap justify-center gap-3">
            <PrimaryButton href={CHROME_STORE_URL}>Add to Chrome — Free</PrimaryButton>
            <GhostButton href="#how">See how it works</GhostButton>
          </div>
          <p className="relative mt-5 text-[13px] text-ink-muted">{TRUST_TRIAD}</p>
        </div>
      </Container>
    </Section>
  );
}

/* ============================ FOOTER ============================ */
function Footer() {
  const cols = [
    ['Product', [['Features', '#features'], ['How it works', '#how'], ['Privacy', '#privacy']]],
    ['Resources', [['FAQ', '#faq'], ['GitHub', GITHUB_URL]]],
    ['Get Impleo', [['Add to Chrome', CHROME_STORE_URL]]],
  ];
  return (
    <footer className="bg-jungle">
      <Container className="grid grid-cols-2 gap-8 py-14 md:grid-cols-4">
        <div className="col-span-2 md:col-span-1">
          <div className="flex items-center gap-2">
            <img src="/chameleon.png" alt="" className="h-7 w-7" />
            <span className="text-[18px] font-semibold text-ink-primary">Impleo</span>
          </div>
          <p className="mt-3 max-w-[24ch] text-[13px] leading-relaxed text-ink-muted">
            AI autofill for application forms — you stay in control.
          </p>
        </div>
        {cols.map(([title, links]) => (
          <div key={title}>
            <h4 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-secondary">
              {title}
            </h4>
            <ul className="mt-4 space-y-2">
              {links.map(([label, href]) => (
                <li key={label}>
                  <a
                    href={href}
                    className="text-[14px] text-ink-muted transition duration-150 hover:text-ink-primary"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Container>
      <div className="border-t border-white/5">
        <Container className="flex flex-col items-center justify-between gap-2 py-6 sm:flex-row">
          <p className="text-[12px] text-ink-muted">© {new Date().getFullYear()} Impleo. Local-first, single-user.</p>
          <p className="text-[12px] text-ink-muted">Never auto-submits. Ever.</p>
        </Container>
      </div>
    </footer>
  );
}

/* ============================== APP ============================== */
export default function App() {
  return (
    <div className="min-h-screen bg-surface-bg">
      <Nav />
      <main>
        <Hero />
        <WorksOn />
        <Problem />
        <HowItWorks />
        <Features />
        <ReviewTrust />
        <Providers />
        <Privacy />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
