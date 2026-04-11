/**
 * Thin HTTP client for Jest API integration tests.
 * Uses the `cookie` jar to carry httpOnly cookies across requests (simulating a browser).
 */
import axios, { type AxiosInstance, type AxiosResponse } from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';

export const API_BASE = process.env.API_URL ?? 'http://localhost:3001/api/v1';
export const DSP_BASE = process.env.DSP_URL ?? 'http://localhost:5000';

/**
 * Create a new axios instance with a dedicated cookie jar.
 * Each test that needs separate sessions should call createClient() to get an isolated jar.
 */
export function createClient(): AxiosInstance {
  const jar = new CookieJar();
  const client = wrapper(
    axios.create({
      baseURL: API_BASE,
      withCredentials: true,
      validateStatus: () => true,    // Never throw on non-2xx — we assert status in tests
    }),
  );
  (client.defaults as any).jar = jar;
  return client;
}

/** Shared client for tests that don't need session isolation */
export const api = createClient();

/** Raw API call without cookie jar (for public endpoints) */
export const rawApi = axios.create({
  baseURL: API_BASE,
  validateStatus: () => true,
});

export function extractData<T = unknown>(res: AxiosResponse): T {
  return res.data.data as T;
}

export function extractError(res: AxiosResponse): { code: string; message: string } {
  return res.data.error;
}
