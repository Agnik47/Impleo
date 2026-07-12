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
  getQaHistory: () => request('/api/qa-history'),
  appendQaHistory: (entry) =>
    request('/api/qa-history', { method: 'POST', body: JSON.stringify(entry) }),
  generateAnswers: (formSchema) =>
    request('/api/generate-answers', { method: 'POST', body: JSON.stringify({ formSchema }) }),
  regenerateAnswer: (question, instruction) =>
    request('/api/regenerate-answer', {
      method: 'POST',
      body: JSON.stringify({ question, instruction }),
    }),
};
