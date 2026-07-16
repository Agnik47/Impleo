const API_BASE = 'http://localhost:3001';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'content-type': 'application/json' },
    ...options,
  });
  const contentType = res.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await res.json() : null;
  if (!res.ok) {
    throw new Error(body?.error || `Request to ${path} failed with ${res.status}`);
  }
  return body;
}

export const api = {
  getProfile: () => request('/api/profile'),
  saveProfile: (profile) =>
    request('/api/profile', { method: 'PUT', body: JSON.stringify(profile) }),
  getSettings: () => request('/api/settings'),
  // Saves the key/model for `provider` (whichever are given) and makes it
  // active. Pass no apiKey/model to just switch the active provider to one
  // that's already configured.
  saveSettings: (provider, apiKey, model) =>
    request('/api/settings', {
      method: 'PUT',
      body: JSON.stringify({ provider, ...(apiKey ? { apiKey } : {}), ...(model ? { model } : {}) }),
    }),
  testApiKey: (provider, apiKey, model) =>
    request('/api/test-key', { method: 'POST', body: JSON.stringify({ provider, apiKey, model }) }),
  exportProfile: () => request('/api/export'),
  importProfile: (envelope, opts) =>
    request('/api/import', {
      method: 'POST',
      body: JSON.stringify({ ...envelope, dryRun: Boolean(opts?.dryRun) }),
    }),
  getQaHistory: () => request('/api/qa-history'),
  appendQaHistory: (entry) =>
    request('/api/qa-history', { method: 'POST', body: JSON.stringify(entry) }),
  getIdentityMemory: () => request('/api/identity-memory'),
  saveIdentityMemory: (canonicalKey, value, source) =>
    request('/api/identity-memory', {
      method: 'PUT',
      body: JSON.stringify({ canonicalKey, value, ...(source ? { source } : {}) }),
    }),
  deleteIdentityMemory: (canonicalKey) =>
    request(`/api/identity-memory/${encodeURIComponent(canonicalKey)}`, { method: 'DELETE' }),
  getLearnedAnswers: () => request('/api/learned-answers'),
  // Records a user-confirmed answer so the same question resolves for free next
  // time. The server decides whether the answer is actually learnable (see
  // learnedMemory.js) and answers { ok: true, learned: false } when it isn't.
  saveLearnedAnswer: ({ questionText, answer, canonicalKey, fieldType, source }) =>
    request('/api/learned-answers', {
      method: 'PUT',
      body: JSON.stringify({ questionText, answer, canonicalKey, fieldType, source }),
    }),
  deleteLearnedAnswer: (questionNorm) =>
    request(`/api/learned-answers/${encodeURIComponent(questionNorm)}`, { method: 'DELETE' }),
  // --- Identity documents ---
  // Bytes live in the server's SQLite DB (AGENTS.md rule 3: the server owns all
  // persistence), and move over this localhost API as base64. They never reach a
  // remote host: the only outbound call this feature can make is the tie-break in
  // recommendDocument, which sends labels and filenames — never file contents.
  getDocuments: () => request('/api/documents'),
  uploadDocument: ({ originalName, mimeType, contentBase64, userDefinedLabel }) =>
    request('/api/documents', {
      method: 'POST',
      body: JSON.stringify({ originalName, mimeType, contentBase64, userDefinedLabel }),
    }),
  getDocumentContent: (fileId) => request(`/api/documents/${encodeURIComponent(fileId)}/content`),
  renameDocument: (fileId, userDefinedLabel) =>
    request(`/api/documents/${encodeURIComponent(fileId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ userDefinedLabel }),
    }),
  replaceDocumentContent: (fileId, { originalName, mimeType, contentBase64 }) =>
    request(`/api/documents/${encodeURIComponent(fileId)}/content`, {
      method: 'PUT',
      body: JSON.stringify({ originalName, mimeType, contentBase64 }),
    }),
  deleteDocument: (fileId) =>
    request(`/api/documents/${encodeURIComponent(fileId)}`, { method: 'DELETE' }),
  // Records an actual injection (and, with a domain, that site's preference for
  // next time). Called only after a successful approved fill — never on selection.
  markDocumentUsed: (fileId, domain) =>
    request(`/api/documents/${encodeURIComponent(fileId)}/used`, {
      method: 'POST',
      body: JSON.stringify({ domain }),
    }),
  getDomainDocumentPreference: (domain) =>
    request(`/api/document-preferences/${encodeURIComponent(domain)}`),
  // Ranks stored documents for one detected field. Side-effect free by construction:
  // it returns a suggestion, and cannot cause an upload.
  recommendDocument: ({ fieldLabel, pageTitle, pageUrl, formText }) =>
    request('/api/recommend-document', {
      method: 'POST',
      body: JSON.stringify({ fieldLabel, pageTitle, pageUrl, formText }),
    }),

  generateAnswers: (formSchema) =>
    request('/api/generate-answers', { method: 'POST', body: JSON.stringify({ formSchema }) }),
  regenerateAnswer: (question, instruction) =>
    request('/api/regenerate-answer', {
      method: 'POST',
      body: JSON.stringify({ question, instruction }),
    }),
};
