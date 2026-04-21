/**
 * E2E tests for Phase 7 — Payments.
 * Run with: npm run test:e2e
 *
 * Prerequisites: docker-compose up (postgres, redis, mailhog).
 * Uses Supertest against the real NestJS app.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../app.module';

describe('PaymentsController (e2e)', () => {
  let app: INestApplication;
  let premiumUserToken: string;
  let adminToken: string;
  let regularUserId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    // TODO: seed a verified user + admin via AuthService, capture JWT cookies
  });

  afterAll(async () => {
    await app.close();
  });

  // ── VNPay ────────────────────────────────────────────────────────────────

  describe('GET /payment/vn-pay', () => {
    it('returns a VNPay payment URL for valid premiumType', async () => {
      // TODO: use premiumUserToken cookie
      const res = await request(app.getHttpServer())
        .get('/api/v1/payment/vn-pay?premiumType=1_MONTH')
        .expect(200);

      expect(res.body.data).toHaveProperty('paymentUrl');
      expect(res.body.data.paymentUrl).toContain('vnp_TmnCode');
      expect(res.body.data.paymentUrl).toContain('vnp_SecureHash');
    });

    it('returns 400 for invalid premiumType', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/payment/vn-pay?premiumType=INVALID')
        .expect(400);
    });

    it('returns 401 for unauthenticated request', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/payment/vn-pay?premiumType=1_MONTH')
        .expect(401);
    });
  });

  describe('GET /payment/vn-pay/callback', () => {
    it('redirects to failure URL on invalid signature', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/payment/vn-pay/callback')
        .query({
          vnp_TxnRef: 'fake-id',
          vnp_ResponseCode: '00',
          vnp_SecureHash: 'badsignature',
          vnp_Amount: '3000000',
          vnp_TransactionNo: '12345',
        });
      // Should throw 400 (invalid signature)
      expect([302, 400]).toContain(res.status);
    });
  });

  // ── MoMo ─────────────────────────────────────────────────────────────────

  describe('POST /payment/momo', () => {
    it('returns 400 for invalid premiumType', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/payment/momo?premiumType=INVALID')
        .expect(400);
    });
  });

  // ── Admin ─────────────────────────────────────────────────────────────────

  describe('POST /payment/admin/users/:userId/premium', () => {
    it('returns 403 for non-admin users', async () => {
      // TODO: use premiumUserToken cookie
      await request(app.getHttpServer())
        .post(`/api/v1/payment/admin/users/${regularUserId}/premium`)
        .send({ premiumType: '1_MONTH' })
        .expect(403);
    });

    it('returns 400 for invalid premiumType', async () => {
      // TODO: use adminToken cookie
      await request(app.getHttpServer())
        .post(`/api/v1/payment/admin/users/${regularUserId}/premium`)
        .send({ premiumType: 'INVALID' })
        .expect(400);
    });
  });
});


