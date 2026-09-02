// Runs the real generation path against a real model with your own key, then
// scores what comes back. This is the before/after number for any prompt or
// context change.
//
// Deliberately NOT part of `npm test`: it costs tokens and needs a key, so it
// must never run in CI. The deterministic checks in assertions.js are the
// CI-enforced floor; this is the thing that can actually tell you whether an
// answer sounds like a person.
//
//   IMPLEO_PROVIDER=groq IMPLEO_API_KEY=gsk_... npm run eval:live
//
// Optional:
//   IMPLEO_MODEL=...     override the provider's default model
//   IMPLEO_RUNS=3        repeat each fixture and average (default 2 — the
//                        judge is itself an LLM and has real variance, so a
//                        single run is not a measurement)
//   IMPLEO_FIXTURE=name  run just one fixture

import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { installChromeStub, seedStorage, resetStorage } from '../setup/chromeStub.js';
import { TEST_PROFILE, PROFILE_PARTICULARS } from '../fixtures/profile.js';
import { evaluateAnswers, formatReport } from './assertions.js';

installChromeStub();

const { generateAnswers } = await import('../../src/sidepanel/lib/generate.js');
const { PROVIDERS, KEY_COLUMN, MODEL_COLUMN, DEFAULT_MODELS } = await import(
  '../../src/sidepanel/lib/providers.js'
);

const here = dirname(fileURLToPath(import.meta.url));
const schemaDir = join(here, '..', 'fixtures', 'schemas');
const reportDir = join(here, 'reports');

const provider = process.env.IMPLEO_PROVIDER;
const apiKey = process.env.IMPLEO_API_KEY;
const model = process.env.IMPLEO_MODEL || DEFAULT_MODELS[provider];
const runs = Number(process.env.IMPLEO_RUNS || 2);

if (!provider || !PROVIDERS[provider]) {
  console.error(`IMPLEO_PROVIDER must be one of: ${Object.keys(PROVIDERS).join(', ')}`);
  process.exit(1);
}
if (!apiKey) {
  console.error('IMPLEO_API_KEY is required. This script makes real, billable API calls.');
  process.exit(1);
}

const SETTINGS = { provider, [KEY_COLUMN[provider]]: apiKey, [MODEL_COLUMN[provider]]: model };
const profileText = JSON.stringify(TEST_PROFILE);

// Mirrors ReviewFlow.jsx's whitelist exactly. If this drifts, the eval measures
// a prompt the real app never sends.
function asSentSchema(schema) {
  return schema.map(({ id, questionText, fieldType, options, required, description, labelConfidence }) => ({
    id,
    questionText,
    fieldType,
    options,
    required,
    ...(description ? { description } : {}),
    ...(labelConfidence ? { labelConfidence } : {}),
  }));
}

const RUBRIC = `You are grading answers a tool drafted on someone's behalf for a real application form.

You will be given the applicant's PROFILE, then a list of QUESTION/ANSWER pairs.

Score each answer 1-5 on four axes:

- "voice": does this sound like the person who wrote the WRITING SAMPLE in the profile?
  5 = indistinguishable from the sample's voice. 1 = generic application-ese that
  any candidate could have submitted. Be harsh here. "Professional but anonymous"
  is a 2, not a 4.
- "specificity": does it name real particulars from the profile (a named project,
  a real number, a place, an actual event) rather than gesturing at qualities?
  5 = built around a concrete particular. 1 = entirely abstract.
- "grounded": is every factual claim supported by the profile? 5 = fully supported.
  1 = invents companies, metrics, titles or experience.
  IMPORTANT: an answer that honestly says it lacks the relevant experience is a 5
  on this axis, not a failure. Refusing to invent is correct behaviour.
- "believable": would a reader assume a human wrote this? 5 = certainly.
  1 = obviously machine-generated.

Respond with ONLY a raw JSON array, no markdown fences, no commentary:
[{"id":"...","voice":n,"specificity":n,"grounded":n,"believable":n,"note":"one short sentence on the weakest axis"}]
One entry per question given, using the exact ids provided.`;

function stripFences(text) {
  return text.trim().replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/, '').trim();
}

async function judge(pairs) {
  if (pairs.length === 0) return [];
  const userContent = JSON.stringify({
    profile: TEST_PROFILE,
    answers: pairs.map((p) => ({ id: p.id, question: p.questionText, answer: p.answer })),
  });
  const text = await PROVIDERS[provider].chat({
    apiKey,
    model,
    systemPrompt: RUBRIC,
    userContent,
    maxTokens: 2000,
    temperature: 0.1, // grading should be as repeatable as the model allows
  });
  try {
    const parsed = JSON.parse(stripFences(text));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    console.warn('  (judge returned unparseable output for this run — skipped)');
    return [];
  }
}

function mean(nums) {
  const valid = nums.filter((n) => typeof n === 'number' && Number.isFinite(n));
  if (!valid.length) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function fmt(n) {
  return n == null ? '—' : n.toFixed(2);
}

const fixtures = readdirSync(schemaDir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(schemaDir, f), 'utf8')))
  .filter((f) => !process.env.IMPLEO_FIXTURE || f.name === process.env.IMPLEO_FIXTURE);

if (fixtures.length === 0) {
  console.error('No fixtures matched.');
  process.exit(1);
}

const summary = [];

for (const fixture of fixtures) {
  console.log(`\n=== ${fixture.name} (${fixture.schema.length} fields, ${runs} run${runs > 1 ? 's' : ''}) ===`);
  if (String(fixture.source || '').startsWith('SYNTHETIC')) {
    console.log('  note: synthetic fixture — see test/fixtures/README.md on capturing real ones');
  }

  const perRun = [];

  for (let run = 1; run <= runs; run += 1) {
    resetStorage();
    seedStorage({ settings: SETTINGS, profile: TEST_PROFILE });

    let answers;
    try {
      ({ answers } = await generateAnswers(asSentSchema(fixture.schema)));
    } catch (err) {
      console.error(`  run ${run}: generation FAILED — ${err.message}`);
      perRun.push({ run, error: err.message });
      continue;
    }

    const checks = evaluateAnswers(fixture.schema, answers, {
      profileText,
      particulars: PROFILE_PARTICULARS,
    });
    console.log(`  run ${run}: ${formatReport(checks).split('\n')[0]}`);
    for (const line of formatReport(checks).split('\n').slice(1)) console.log(`  ${line}`);

    // Only prose is worth a judge call — grading "Riya Menon" on voice is noise.
    const byId = new Map(answers.map((a) => [a.id, a]));
    const prose = fixture.schema
      .filter((f) => f.fieldType === 'textarea')
      .map((f) => ({ id: f.id, questionText: f.questionText, answer: byId.get(f.id)?.answer }))
      .filter((p) => typeof p.answer === 'string' && p.answer.trim());

    const scores = await judge(prose);
    perRun.push({ run, checks, scores, answers, prose });
  }

  const allScores = perRun.flatMap((r) => r.scores || []);
  const axes = {
    voice: mean(allScores.map((s) => s.voice)),
    specificity: mean(allScores.map((s) => s.specificity)),
    grounded: mean(allScores.map((s) => s.grounded)),
    believable: mean(allScores.map((s) => s.believable)),
  };
  const failures = perRun.reduce((n, r) => n + (r.checks?.failures.length || 0), 0);
  const warnings = perRun.reduce((n, r) => n + (r.checks?.warnings.length || 0), 0);

  console.log(
    `  SCORES  voice ${fmt(axes.voice)}  specificity ${fmt(axes.specificity)}  ` +
      `grounded ${fmt(axes.grounded)}  believable ${fmt(axes.believable)}`
  );

  summary.push({ fixture, axes, failures, warnings, perRun });
}

// --- report ---------------------------------------------------------------

const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
mkdirSync(reportDir, { recursive: true });

const lines = [
  `# Eval run — ${stamp}`,
  '',
  `Provider: \`${provider}\` · Model: \`${model}\` · Runs per fixture: ${runs}`,
  '',
  '| Fixture | Voice | Specificity | Grounded | Believable | Failures | Warnings |',
  '|---|---|---|---|---|---|---|',
];
for (const s of summary) {
  lines.push(
    `| ${s.fixture.name} | ${fmt(s.axes.voice)} | ${fmt(s.axes.specificity)} | ` +
      `${fmt(s.axes.grounded)} | ${fmt(s.axes.believable)} | ${s.failures} | ${s.warnings} |`
  );
}

lines.push('', '## Answers', '');
for (const s of summary) {
  lines.push(`### ${s.fixture.name}`, '');
  const last = [...s.perRun].reverse().find((r) => r.prose);
  for (const p of last?.prose || []) {
    const score = (last.scores || []).find((x) => x.id === p.id);
    lines.push(`**${p.questionText}**`, '');
    lines.push('> ' + String(p.answer).replace(/\n+/g, '\n> '), '');
    if (score) {
      lines.push(
        `voice ${score.voice} · specificity ${score.specificity} · grounded ${score.grounded} · ` +
          `believable ${score.believable} — ${score.note || ''}`,
        ''
      );
    }
  }
  const checkLines = s.perRun.flatMap((r) => (r.checks ? formatReport(r.checks).split('\n').slice(1) : []));
  if (checkLines.length) {
    lines.push('**Deterministic checks**', '', '```', ...checkLines, '```', '');
  }
}

const reportPath = join(reportDir, `${stamp}.md`);
writeFileSync(reportPath, lines.join('\n'), 'utf8');
console.log(`\nReport written to ${reportPath}`);
console.log('Compare against your previous run. A prompt change with no score movement did nothing.');
