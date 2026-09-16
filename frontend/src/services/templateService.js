import { api } from './api.js';

/** Saved section templates — an admin's own layouts, reusable on any section. */
export async function listTemplates() {
  return (await api.get('/templates')).templates;
}

export async function saveTemplate(payload) {
  return (await api.post('/templates', payload)).template;
}

export async function deleteTemplate(templateId) {
  return api.delete(`/templates/${templateId}`);
}
