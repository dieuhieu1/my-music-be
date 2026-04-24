import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AuditService } from '../audit/audit.service';
import { Role } from '../../common/enums';

const adminUser = { id: 'admin-1', roles: [Role.ADMIN] };

const mockAdminService: Partial<AdminService> = {
  listSongsAdmin:          jest.fn().mockResolvedValue({ items: [], totalItems: 0, page: 1, size: 20, totalPages: 0 }),
  listUsers:               jest.fn().mockResolvedValue({ items: [], totalItems: 0, page: 1, size: 20, totalPages: 0 }),
  getUserDetail:           jest.fn().mockResolvedValue({ id: 'u1' }),
  updateUserRoles:         jest.fn().mockResolvedValue({ id: 'u1', roles: [Role.USER] }),
  getUserSessions:         jest.fn().mockResolvedValue([]),
  deleteUserSession:       jest.fn().mockResolvedValue(undefined),
  getAuditLogs:            jest.fn().mockResolvedValue({ items: [], totalItems: 0, page: 1, size: 20, totalPages: 0 }),
  listPayments:            jest.fn().mockResolvedValue({ items: [], totalItems: 0, page: 1, size: 20, totalPages: 0 }),
  listManualGrants:        jest.fn().mockResolvedValue({ items: [], totalItems: 0, page: 1, size: 20, totalPages: 0 }),
  adminGrantPremium:       jest.fn().mockResolvedValue(undefined),
  adminRevokePremiumAdmin: jest.fn().mockResolvedValue(undefined),
  listReports:             jest.fn().mockResolvedValue({ items: [], totalItems: 0, page: 1, size: 20, totalPages: 0 }),
  dismissReport:           jest.fn().mockResolvedValue({ id: 'r1', status: 'DISMISSED' }),
  takedownReport:          jest.fn().mockResolvedValue({ id: 'r1', status: 'RESOLVED' }),
  approveSong:             jest.fn().mockResolvedValue({ id: 's1' }),
  rejectSong:              jest.fn().mockResolvedValue({ id: 's1' }),
  requestReupload:         jest.fn().mockResolvedValue({ id: 's1' }),
  restoreSong:             jest.fn().mockResolvedValue({ id: 's1' }),
  findAllGenreSuggestions: jest.fn().mockResolvedValue([]),
  approveGenreSuggestion:  jest.fn().mockResolvedValue({}),
  rejectGenreSuggestion:   jest.fn().mockResolvedValue({}),
};

const mockAuditService: Partial<AuditService> = {
  findAll: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 }),
};

describe('AdminController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        { provide: AdminService,  useValue: mockAdminService },
        { provide: AuditService,  useValue: mockAuditService },
      ],
    })
      .overrideGuard(require('../../common/guards/jwt-auth.guard').JwtAuthGuard)
      .useValue({ canActivate: (ctx: any) => { ctx.switchToHttp().getRequest().user = adminUser; return true; } })
      .overrideGuard(require('../../common/guards/roles.guard').RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(() => app.close());

  it('GET /admin/songs → 200', () =>
    request(app.getHttpServer()).get('/admin/songs').expect(200));

  it('GET /admin/users → 200', () =>
    request(app.getHttpServer()).get('/admin/users').expect(200));

  it('GET /admin/users/:userId → 200', () =>
    request(app.getHttpServer())
      .get('/admin/users/00000000-0000-0000-0000-000000000001')
      .expect(200));

  it('PATCH /admin/users/:userId/roles → 200 with valid body', () =>
    request(app.getHttpServer())
      .patch('/admin/users/00000000-0000-0000-0000-000000000001/roles')
      .send({ roles: [Role.USER, Role.ARTIST] })
      .expect(200));

  it('PATCH /admin/users/:userId/roles → 400 with invalid role', () =>
    request(app.getHttpServer())
      .patch('/admin/users/00000000-0000-0000-0000-000000000001/roles')
      .send({ roles: ['INVALID_ROLE'] })
      .expect(400));

  it('GET /admin/users/:userId/sessions → 200', () =>
    request(app.getHttpServer())
      .get('/admin/users/00000000-0000-0000-0000-000000000001/sessions')
      .expect(200));

  it('DELETE /admin/users/:userId/sessions/:sessionId → 204', () =>
    request(app.getHttpServer())
      .delete('/admin/users/00000000-0000-0000-0000-000000000001/sessions/00000000-0000-0000-0000-000000000002')
      .expect(204));

  it('GET /admin/audit → 200', () =>
    request(app.getHttpServer()).get('/admin/audit').expect(200));

  it('GET /admin/payments → 200', () =>
    request(app.getHttpServer()).get('/admin/payments').expect(200));

  it('GET /admin/payments/manual-grants → 200', () =>
    request(app.getHttpServer()).get('/admin/payments/manual-grants').expect(200));

  it('POST /admin/payments/grant → 201 with valid body', () =>
    request(app.getHttpServer())
      .post('/admin/payments/grant')
      .send({ userId: '00000000-0000-0000-0000-000000000001', durationDays: 30 })
      .expect(201));

  it('POST /admin/payments/grant → 400 with invalid durationDays', () =>
    request(app.getHttpServer())
      .post('/admin/payments/grant')
      .send({ userId: '00000000-0000-0000-0000-000000000001', durationDays: 0 })
      .expect(400));

  it('GET /admin/reports → 200', () =>
    request(app.getHttpServer()).get('/admin/reports').expect(200));

  it('PATCH /admin/reports/:id/dismiss → 200', () =>
    request(app.getHttpServer())
      .patch('/admin/reports/00000000-0000-0000-0000-000000000001/dismiss')
      .send({})
      .expect(200));

  it('PATCH /admin/reports/:id/takedown → 200', () =>
    request(app.getHttpServer())
      .patch('/admin/reports/00000000-0000-0000-0000-000000000001/takedown')
      .send({})
      .expect(200));
});
