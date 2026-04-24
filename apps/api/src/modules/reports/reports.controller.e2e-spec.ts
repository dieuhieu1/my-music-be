import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ContentTargetType, ReportReason } from '../../common/enums';

describe('ReportsController (e2e)', () => {
  let app: INestApplication;
  const mockService: Partial<ReportsService> = {
    create: jest.fn().mockResolvedValue({ id: 'report-1', status: 'PENDING' }),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [{ provide: ReportsService, useValue: mockService }],
    })
      .overrideGuard(require('../../common/guards/jwt-auth.guard').JwtAuthGuard)
      .useValue({ canActivate: (ctx: any) => {
        ctx.switchToHttp().getRequest().user = { id: 'user-1' };
        return true;
      }})
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(() => app.close());

  describe('POST /reports', () => {
    it('201 — creates report with valid payload', () =>
      request(app.getHttpServer())
        .post('/reports')
        .send({ targetType: ContentTargetType.SONG, targetId: '00000000-0000-0000-0000-000000000001', reason: ReportReason.EXPLICIT })
        .expect(201));

    it('400 — rejects invalid targetType', () =>
      request(app.getHttpServer())
        .post('/reports')
        .send({ targetType: 'INVALID', targetId: '00000000-0000-0000-0000-000000000001', reason: ReportReason.EXPLICIT })
        .expect(400));

    it('400 — rejects non-UUID targetId', () =>
      request(app.getHttpServer())
        .post('/reports')
        .send({ targetType: ContentTargetType.SONG, targetId: 'not-a-uuid', reason: ReportReason.EXPLICIT })
        .expect(400));
  });
});
