const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(BASE + path, {
    credentials: 'include',
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    ...options,
  });
  let data = null;
  try { data = await res.json(); } catch { /* no body */ }
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  login: (payload) => request('/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),

  getProfile: () => request('/profile'),
  updateProfile: (payload) => request('/profile', { method: 'PUT', body: JSON.stringify(payload) }),

  getCourses: () => request('/sections/courses'),

  getMyApplications: () => request('/applications/mine'),
  submitApplication: (payload) => request('/applications', { method: 'POST', body: JSON.stringify(payload) }),

  getFacultyApplications: (query = '') => request(`/faculty/applications${query}`),
  updateApplicationStatus: (id, status, extra = {}) => request(`/faculty/applications/${id}`, { method: 'PATCH', body: JSON.stringify({ status, ...extra }) }),
  getApplicationSections: (id) => request(`/faculty/applications/${id}/sections`),
  assignApplication: (id, sectionId, hours) => request(`/faculty/applications/${id}/assign`, { method: 'PATCH', body: JSON.stringify({ sectionId, hours }) }),

  adminGetUsers: () => request('/admin/users'),
  adminGetSections: () => request('/admin/sections'),
  adminCreateSection: (payload) => request('/admin/sections', { method: 'POST', body: JSON.stringify(payload) }),
  adminDeleteSection: (id) => request(`/admin/sections/${id}`, { method: 'DELETE' }),
};
