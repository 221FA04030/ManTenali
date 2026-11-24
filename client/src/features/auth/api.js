import { api } from '../../lib/apiClient.js';

export const authKeys = { me: ['auth', 'me'] };

export const authApi = {
  me: () => api.get('/auth/me', { skipAuthRedirect: true }).then((r) => r.data),
  login: (body) => api.post('/auth/login', body, { skipAuthRedirect: true }).then((r) => r.data),
  register: (body) => api.post('/auth/register', body).then((r) => r.data),
  google: (idToken) => api.post('/auth/google', { idToken }, { skipAuthRedirect: true }).then((r) => r.data),
  logout: () => api.post('/auth/logout', undefined, { skipAuthRedirect: true }).then((r) => r.data),
  updateMe: (body) => api.patch('/users/me', body).then((r) => r.data),
};
