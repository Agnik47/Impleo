// The single source of truth for Impleo's semantic "identity" fields — the small,
// closed set of personal-identity values a user enters once and reuses across any
// form (see docs/INTELLIGENT_FIELD_MEMORY.md). This is deliberately NOT a giant
// synonym dictionary: the registry defines WHICH canonical keys exist; the AI (in
// generate.js) decides which key an arbitrary/multilingual field maps to. `aliases`
// are a seed for the fast offline local matcher below AND double as few-shot hints
// in the AI prompt — they don't need to be exhaustive.
//
// `sensitive: true` marks values (Aadhaar, DOB, etc.) that are government/financial
// IDs — used to warn on plaintext export, not to block anything.
export const CANONICAL_FIELDS = [
  {
    key: 'full_name',
    label: 'Full Name',
    type: 'text',
    sensitive: false,
    aliases: ['full name', 'name', 'applicant name', 'candidate name', 'your name', 'नाम', 'पूरा नाम'],
  },
  {
    key: 'father_name',
    label: "Father's Name",
    type: 'text',
    sensitive: false,
    aliases: [
      'father name', "father's name", 'father / guardian name', 'father/guardian name',
      'guardian name', 'name of father', "father's / guardian's name",
      'पिता का नाम', 'अभिभावक का नाम', 'पिता / अभिभावक का नाम',
    ],
  },
  {
    key: 'mother_name',
    label: "Mother's Name",
    type: 'text',
    sensitive: false,
    aliases: ['mother name', "mother's name", 'name of mother', 'माता का नाम', 'माँ का नाम'],
  },
  {
    key: 'date_of_birth',
    label: 'Date of Birth',
    type: 'date',
    sensitive: true,
    aliases: ['dob', 'date of birth', 'birth date', 'd.o.b', 'जन्म तिथि', 'जन्म तारीख'],
  },
  {
    key: 'gender',
    label: 'Gender',
    type: 'select',
    sensitive: false,
    aliases: ['gender', 'sex', 'लिंग'],
  },
  {
    key: 'nationality',
    label: 'Nationality',
    type: 'text',
    sensitive: false,
    aliases: ['nationality', 'citizenship', 'राष्ट्रीयता', 'नागरिकता'],
  },
  {
    key: 'marital_status',
    label: 'Marital Status',
    type: 'select',
    sensitive: false,
    aliases: ['marital status', 'वैवाहिक स्थिति'],
  },
  {
    key: 'religion',
    label: 'Religion',
    type: 'text',
    sensitive: false,
    aliases: ['religion', 'धर्म'],
  },
  {
    key: 'category',
    label: 'Category',
    type: 'select',
    sensitive: false,
    // "Category" on Indian gov forms = reservation category (General/OBC/SC/ST).
    aliases: ['category', 'caste category', 'reservation category', 'श्रेणी', 'वर्ग'],
  },
  {
    key: 'phone',
    label: 'Phone Number',
    type: 'text',
    sensitive: false,
    aliases: ['phone', 'phone number', 'mobile', 'mobile number', 'contact number', 'मोबाइल नंबर', 'फ़ोन नंबर'],
  },
  {
    key: 'email',
    label: 'Email',
    type: 'text',
    sensitive: false,
    aliases: ['email', 'email address', 'e-mail', 'ईमेल'],
  },
  {
    key: 'address',
    label: 'Address',
    type: 'textarea',
    sensitive: false,
    aliases: ['address', 'residential address', 'permanent address', 'current address', 'पता'],
  },
  {
    key: 'city',
    label: 'City',
    type: 'text',
    sensitive: false,
    aliases: ['city', 'town', 'शहर'],
  },
  {
    key: 'state',
    label: 'State',
    type: 'text',
    sensitive: false,
    aliases: ['state', 'राज्य'],
  },
  {
    key: 'district',
    label: 'District',
    type: 'text',
    sensitive: false,
    aliases: ['district', 'जिला'],
  },
  {
    key: 'pincode',
    label: 'PIN Code',
    type: 'text',
    sensitive: false,
    aliases: ['pincode', 'pin code', 'postal code', 'zip', 'zip code', 'पिन कोड'],
  },
  {
    key: 'country',
    label: 'Country',
    type: 'text',
    sensitive: false,
    aliases: ['country', 'देश'],
  },
  {
    key: 'aadhaar_number',
    label: 'Aadhaar Number',
    type: 'text',
    sensitive: true,
    aliases: ['aadhaar number', 'aadhar number', 'aadhaar', 'aadhar', 'uid number', 'uid', 'आधार संख्या', 'आधार नंबर'],
  },
  {
    key: 'pan_number',
    label: 'PAN Number',
    type: 'text',
    sensitive: true,
    aliases: ['pan number', 'pan card number', 'pan', 'permanent account number', 'पैन नंबर'],
  },
  {
    key: 'passport_number',
    label: 'Passport Number',
    type: 'text',
    sensitive: true,
    aliases: ['passport number', 'passport no', 'passport', 'पासपोर्ट नंबर'],
  },
];

export const CANONICAL_KEYS = new Set(CANONICAL_FIELDS.map((f) => f.key));

const FIELD_BY_KEY = new Map(CANONICAL_FIELDS.map((f) => [f.key, f]));

export function isValidKey(key) {
  return typeof key === 'string' && CANONICAL_KEYS.has(key);
}

export function labelFor(key) {
  return FIELD_BY_KEY.get(key)?.label ?? null;
}

export function isSensitiveKey(key) {
  return Boolean(FIELD_BY_KEY.get(key)?.sensitive);
}

// Keys where a wrong classification is especially costly: the mutually-confusable
// "person name" cluster (full_name/father_name/mother_name — the exact cluster
// involved in a real misclassification incident) plus every sensitive government/
// financial ID. For these, generate.js requires local+AI agreement before trusting a
// non-exact local match, rather than trusting the local match unconditionally.
export const RISK_CLUSTER_KEYS = new Set([
  'full_name',
  'father_name',
  'mother_name',
  ...CANONICAL_FIELDS.filter((f) => f.sensitive).map((f) => f.key),
]);

export function isRiskClusterKey(key) {
  return RISK_CLUSTER_KEYS.has(key);
}

// A compact, prompt-friendly description of the registry for the AI: each valid key
// with its human label. Kept small so it costs few tokens.
export function registryPromptList() {
  return CANONICAL_FIELDS.map((f) => `- ${f.key}: ${f.label}`).join('\n');
}

// Lowercase, strip diacritics (é -> e; leaves Devanagari intact — it has no combining
// accents we want to drop here), drop punctuation, collapse whitespace. Deterministic
// and offline; the same normalization is applied to both the field text and aliases.
function normalize(text) {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // combining marks (Latin accents)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ') // punctuation -> space, keep letters/numbers (any script)
    .replace(/\s+/g, ' ')
    .trim();
}

// Precompute normalized aliases once at module load.
const NORMALIZED_ALIASES = CANONICAL_FIELDS.map((f) => ({
  key: f.key,
  aliases: f.aliases.map(normalize).filter(Boolean),
}));

// Generic single-word aliases that are a substring of many other, more specific
// registered phrases across DIFFERENT keys (e.g. 'name' is a substring of every
// "*_name" alias) are excluded from the medium-confidence substring/contains pass
// below — they stay eligible for EXACT match only. Without this, an unrelated field
// like "Company Name" (not a person's own name, no registered key) would
// medium-confidence-misclassify to full_name purely because it ends in " name".
const FUZZY_MATCH_EXCLUDED = new Set(['name']);

// Deterministic, offline first pass. Returns { canonicalKey, confidence } or null.
// Exact normalized alias equality -> high. A whole-word alias contained in the field
// text (or vice-versa) -> medium. Anything fuzzier is left for the AI in generate.js,
// so we never guess here.
export function classifyLocally(questionText) {
  const q = normalize(questionText);
  if (!q) return null;

  for (const { key, aliases } of NORMALIZED_ALIASES) {
    if (aliases.includes(q)) return { canonicalKey: key, confidence: 'high' };
  }

  // Longest aliases first so "father's name" beats a stray "name" match.
  let best = null;
  for (const { key, aliases } of NORMALIZED_ALIASES) {
    for (const alias of aliases) {
      if (alias.length < 3) continue; // avoid matching trivially short aliases as substrings
      if (FUZZY_MATCH_EXCLUDED.has(alias)) continue;
      const contained =
        q === alias ||
        q.includes(` ${alias} `) ||
        q.startsWith(`${alias} `) ||
        q.endsWith(` ${alias}`) ||
        q.includes(alias);
      if (contained && (!best || alias.length > best.aliasLen)) {
        best = { canonicalKey: key, confidence: 'medium', aliasLen: alias.length };
      }
    }
  }
  return best ? { canonicalKey: best.canonicalKey, confidence: best.confidence } : null;
}
