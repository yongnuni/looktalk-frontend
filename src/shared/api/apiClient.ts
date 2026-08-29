import axios, {
  AxiosHeaders,
  type AxiosError,
  type InternalAxiosRequestConfig,
} from 'axios';
import type { ApiResponse } from '../types/backend';
import { useAuthStore } from '../stores/authStore';
import { getAccessToken, storeAccessToken } from './authToken';

interface TokenRefreshResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
}

interface RetriableRequestConfig extends InternalAxiosRequestConfig {
  _authRetry?: boolean;
}

interface ApiErrorBody {
  code?: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api';
const TOKEN_REFRESH_PATH = '/auth/token/refresh';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

/** 응답 interceptor를 타지 않아 refresh 자체의 401이 재시도 루프에 들어가지 않는다. */
export const authRefreshClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

let refreshInFlight: Promise<string> | null = null;

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

function isExpiredAccessTokenError(error: AxiosError<ApiErrorBody>): boolean {
  return (
    error.response?.status === 401 &&
    error.response.data?.code === 'COMMON_TOKEN_EXPIRED'
  );
}

function synchronizeRefreshedAccessToken(accessToken: string): void {
  storeAccessToken(accessToken);
  useAuthStore.setState({ accessToken, isLoggedIn: true });
}

async function expireClientSession(): Promise<void> {
  const role = localStorage.getItem('userRole');
  useAuthStore.getState().logout();

  if (typeof window === 'undefined') {
    return;
  }

  const loginPath = role === 'STAFF' ? '/staff-login' : '/login';
  if (window.location.pathname !== loginPath) {
    window.location.replace(loginPath);
  }
}

async function refreshAccessToken(): Promise<string> {
  try {
    const response = await authRefreshClient.post<ApiResponse<TokenRefreshResponse>>(
      TOKEN_REFRESH_PATH,
    );
    const accessToken = response.data.data?.accessToken?.trim();

    if (!accessToken) {
      throw new Error('토큰 갱신 응답에 Access Token이 없습니다.');
    }

    synchronizeRefreshedAccessToken(accessToken);
    return accessToken;
  } catch (error) {
    await expireClientSession();
    throw error;
  }
}

function getSingleFlightRefresh(): Promise<string> {
  if (!refreshInFlight) {
    refreshInFlight = refreshAccessToken().finally(() => {
      refreshInFlight = null;
    });
  }

  return refreshInFlight;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (unknownError: unknown) => {
    if (!axios.isAxiosError<ApiErrorBody>(unknownError)) {
      throw unknownError;
    }

    const error = unknownError;
    const originalRequest = error.config as RetriableRequestConfig | undefined;

    if (
      !originalRequest ||
      originalRequest._authRetry ||
      originalRequest.url === TOKEN_REFRESH_PATH ||
      !isExpiredAccessTokenError(error)
    ) {
      throw error;
    }

    originalRequest._authRetry = true;
    const accessToken = await getSingleFlightRefresh();
    const headers = AxiosHeaders.from(originalRequest.headers);
    headers.set('Authorization', `Bearer ${accessToken}`);
    originalRequest.headers = headers;

    return apiClient(originalRequest);
  },
);
