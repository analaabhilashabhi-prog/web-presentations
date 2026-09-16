import { api } from './api.js';

export function fetchSession() {
  return api.get('/auth/me');
}

export function login(email, password) {
  return api.post('/auth/login', { email, password });
}

export function logout() {
  return api.post('/auth/logout', {});
}
