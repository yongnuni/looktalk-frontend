import axios from 'axios';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  // 실제 로그인 흐름(LoginPage.tsx/StaffLoginPage.tsx)이 저장하는 key로 통일.
  // 과거 'looktalk_access_token'는 실제 로그인 경로와 연결된 적이 없어 항상 빈 값이었다.
  const token = localStorage.getItem('accessToken');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});