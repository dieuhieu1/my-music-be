/**
 * Phase 1 API Tests — Infrastructure Health
 *
 * Testable outcome:
 *   GET /api/v1/health  → 200  { db: "ok", redis: "ok" }
 *   GET :5000/health    → 200  { status: "ok" }          (DSP sidecar)
 */
import axios from 'axios';
import { API_BASE, DSP_BASE } from '../../helpers/api-client';

describe('Phase 1 — Infrastructure Health', () => {
  describe('NestJS API', () => {
    it('GET /health → 200 with db and redis status', async () => {
      const res = await axios.get(`${API_BASE}/health`, { validateStatus: () => true });

      expect(res.status).toBe(200);
      // NestJS Terminus returns { status: 'ok', info: { database: { status: 'up' }, redis: { status: 'up' } } }
      // wrapped by TransformInterceptor: { success: true, data: { status, info } }
      const { data } = res.data;
      expect(data.status).toBe('ok');
      expect(data.info?.database?.status ?? data.info?.['typeorm']?.status).toBe('up');
      expect(data.info?.redis?.status).toBe('up');
    });

    it('GET /health → response time < 2000ms', async () => {
      const start = Date.now();
      await axios.get(`${API_BASE}/health`, { validateStatus: () => true });
      expect(Date.now() - start).toBeLessThan(2000);
    });

    it('Preflight CORS → Access-Control-Allow-Origin is set', async () => {
      const res = await axios.options(`${API_BASE}/health`, {
        headers: { Origin: 'http://localhost:3000' },
        validateStatus: () => true,
      });
      expect(res.headers['access-control-allow-origin']).toBeTruthy();
    });

    it('Unknown route → 404 with standard error envelope', async () => {
      const res = await axios.get(`${API_BASE}/does-not-exist`, { validateStatus: () => true });

      expect(res.status).toBe(404);
      expect(res.data.success).toBe(false);
      expect(res.data.error).toBeDefined();
    });
  });

  describe('Python DSP Sidecar', () => {
    it('GET /health → 200 { status: "ok" }', async () => {
      const res = await axios.get(`${DSP_BASE}/health`, { validateStatus: () => true });

      expect(res.status).toBe(200);
      expect(res.data.status).toBe('ok');
    });
  });
});
