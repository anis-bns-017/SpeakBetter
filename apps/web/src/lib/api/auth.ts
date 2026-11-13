import { apiClient } from './client';
import type { User } from '../../contexts/useAuth';

export interface RegisterData {
  email: string;
  password: string;
  name: string;
  nativeLanguage?: string;
  learningLanguages?: string[];
}

export interface LoginData {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  // no tokens in response; they are in cookies
}

export const authApi = {
  register: (data: RegisterData) =>
    apiClient.post<AuthResponse>('/auth/register', data),

  login: (data: LoginData) =>
    apiClient.post<AuthResponse>('/auth/login', data),

  logout: () =>
    apiClient.post('/auth/logout'),

  getMe: () =>
    apiClient.get('/auth/me'),

  /** Emails a reset link; the answer is the same whether or not the account exists */
  forgotPassword: (email: string) =>
    apiClient.post<{ ok: true }>('/auth/forgot-password', { email }),

  checkResetToken: (token: string) =>
    apiClient.get<{ valid: boolean }>('/auth/reset-password/check', { params: { token } }),

  resetPassword: (token: string, password: string) =>
    apiClient.post<{ ok: true }>('/auth/reset-password', { token, password }),
};