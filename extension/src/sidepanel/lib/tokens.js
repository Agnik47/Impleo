// Lightweight, dependency-free token accounting for Impleo's LLM calls.
//
// We deliberately use a character-heuristic estimate instead of a real
// tokenizer: no single tokenizer is correct across Anthropic/Gemini/OpenAI/
// Groq, and adding one (tiktoken etc.) is a dependency AGENTS.md tells us to
// avoid. ~3.6 chars/token is a well-worn rule of thumb for English JSON-ish
// payloads. These numbers only drive logging and max_tokens sizing, so being
// within ~15% is more than enough.

const CHARS_PER_TOKEN = 3.6;

export function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(String(text).length / CHARS_PER_TOKEN);
}

// Adaptive completion budget. Only GENERATIVE fields ever reach the model
// (the rest are resolved deterministically), so we size against that count,
// not the whole form.
//
// WHY THIS IS THE HIGHEST-LEVERAGE FIX: Groq's (and OpenAI's) rate limiter
// pre-flight-checks (prompt_tokens + max_tokens) against your per-minute token
// budget BEFORE generating anything. A flat max_tokens=4096 books 4096 tokens
// against quota on every call even when the real answer is 80 tokens — so a
// handful of trivial forms can exhaust a free-tier TPM budget without the
// model ever producing much. Sizing the budget to the actual generative load
// stops that.
//
// Budget = fixed JSON/answer buffer + a per-generative-field prose allowance,
// clamped to a sane floor and ceiling. Roughly matches the requested tiers
// (few fields -> ~512, a dozen -> ~1-2k, many -> up to 4096) but scales
// smoothly and off the count that actually matters.
export function computeMaxTokens(generativeFieldCount) {
  const PER_FIELD = 150; // ~a solid short answer / one paragraph per field
  const BUFFER = 220; // JSON scaffolding + headroom for a couple longer answers
  const FLOOR = 512;
  const CEIL = 4096;
  const budget = BUFFER + Math.max(0, generativeFieldCount) * PER_FIELD;
  return Math.max(FLOOR, Math.min(CEIL, budget));
}

// Emits the per-call token/routing breakdown to the console in the exact
// shape asked for in the optimization brief. Estimates only (see above);
// prefixed so it's greppable in DevTools.
export function logTokenMetrics({
  extracted,
  direct,
  rule,
  generated,
  skipped,
  promptTokens,
  completionTokens,
}) {
  const total = (promptTokens || 0) + (completionTokens || 0);
  const lines = [
    `[Impleo tokens] Fields extracted: ${extracted}`,
    `  Direct lookup:    ${direct}`,
    `  Rule-based:       ${rule}`,
    `  LLM generated:    ${generated}`,
  ];
  if (skipped) lines.push(`  Skipped (upload): ${skipped}`);
  lines.push(
    `  Prompt tokens:    ${promptTokens} (est.)`,
    `  Completion tokens: ${completionTokens} (est.)`,
    `  Estimated total:  ${total}`
  );
  console.log(lines.join('\n'));
}
