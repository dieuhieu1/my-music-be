import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { Role } from '../../common/enums';

const overviewPayload = {
  totalPlays: 100, totalLikes: 50, followerCount: 42,
  topSongs: [{ songId: 's1', title: 'T', coverArtUrl: null, plays: 80, likes: 20 }],
};
const songPayload = {
  songId: 's1', title: 'T',
  plays: { '7d': 10, '30d': 30 },
  likes: 5,
  dailyPlays: [],
};

describe('AnalyticsController (e2e)', () => {
  let app: INestApplication;

  const mockService: Partial<AnalyticsService> = {
    getOverview:      jest.fn().mockResolvedValue(overviewPayload),
    getSongAnalytics: jest.fn().mockResolvedValue(songPayload),
  };

  const jwtUser = { id: 'artist-1', roles: [Role.ARTIST] };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [{ provide: AnalyticsService, useValue: mockService }],
    })
      .overrideGuard(require('../../common/guards/jwt-auth.guard').JwtAuthGuard)
      .useValue({ canActivate: (ctx: any) => { ctx.switchToHttp().getRequest().user = jwtUser; return true; } })
      .overrideGuard(require('../../common/guards/roles.guard').RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(() => app.close());

  describe('GET /artist/analytics/overview', () => {
    it('200 — returns overview for authenticated artist', () =>
      request(app.getHttpServer()).get('/artist/analytics/overview').expect(200));
  });

  describe('GET /artist/analytics/:songId', () => {
    it('200 — returns song analytics', () =>
      request(app.getHttpServer())
        .get('/artist/analytics/00000000-0000-0000-0000-000000000001')
        .expect(200));

    it('400 — rejects non-UUID songId', () =>
      request(app.getHttpServer())
        .get('/artist/analytics/not-a-uuid')
        .expect(400));
  });
});
