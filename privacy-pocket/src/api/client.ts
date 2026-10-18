import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' }
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token') || localStorage.getItem('mfaChallenge');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authApi = {
  login: (data: any) => apiClient.post('/auth/login', data),
  register: (data: any) => apiClient.post('/auth/register', data),
  setupMfa: () => apiClient.post('/auth/setup-mfa'),
  getMfaStatus: () => apiClient.get('/auth/mfa-status'),
  verifyMfa: (code: string) => apiClient.post('/auth/verify-mfa', { code }),
};

export const walletApi = {
  getInventory: () => apiClient.get('/wallet/inventory'),
  getScore: () => apiClient.get('/wallet/score'),
  addConsent: (data: any) => apiClient.post('/wallet/add', data),
  withdrawConsent: (id: number) => apiClient.post(`/wallet/withdraw/${id}`),
};

export const aiApi = {
  analyzePolicy: (text: string) => apiClient.post('/ai/analyze-policy', { text }, { timeout: 70000 }),
  analyzePolicyUrl: (url: string) => apiClient.post('/ai/analyze-url', { url }, { timeout: 70000 }),
};

export const privacyApi = {
  exportPassport: () => apiClient.get('/wallet/passport'),
  importPassport: (passport: unknown) => apiClient.post('/wallet/passport', passport),
  deleteAccount: () => apiClient.delete('/wallet/account'),
};
