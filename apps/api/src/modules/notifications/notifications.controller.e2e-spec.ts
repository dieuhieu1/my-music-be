import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

const mockService = {
  findAll: jest.fn().mockResolvedValue({ items: [], totalItems: 0, page: 1, size: 20, totalPages: 0 }),
  getUnreadCount: jest.fn().mockResolvedValue({ count: 0 }),
  markRead: jest.fn().mockResolvedValue(undefined),
  markAllRead: jest.fn().mockResolvedValue(undefined),
};

// Injects a fixed userId to simulate an authenticated request.
const USER_ID = 'user-uuid-1';
jest.mock('../../common/decorators/current-user.decorator', () => ({
  CurrentUser: () => (_target: unknown, _key: string, index: number) => {
    void index;
  },
}));

describe('NotificationsController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [{ provide: NotificationsService, useValue: mockService }],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
  });

  afterAll(() => app.close());
  beforeEach(() => jest.clearAllMocks());

  describe('GET /notifications', () => {
    it('200 — calls findAll with userId and query', async () => {
      await request(app.getHttpServer()).get('/notifications').expect(200);
      expect(mockService.findAll).toHaveBeenCalledWith(USER_ID, expect.any(Object));
    });
  });

  describe('GET /notifications/unread-count', () => {
    it('200 — returns unread count', async () => {
      await request(app.getHttpServer()).get('/notifications/unread-count').expect(200);
      expect(mockService.getUnreadCount).toHaveBeenCalledWith(USER_ID);
    });
  });

  describe('PATCH /notifications/read-all', () => {
    it('200 — marks all read', async () => {
      await request(app.getHttpServer()).patch('/notifications/read-all').expect(200);
      expect(mockService.markAllRead).toHaveBeenCalledWith(USER_ID);
    });
  });

  describe('PATCH /notifications/:id/read', () => {
    it('200 — marks single notification read', async () => {
      const id = 'notif-uuid-1';
      await request(app.getHttpServer()).patch(`/notifications/${id}/read`).expect(200);
      expect(mockService.markRead).toHaveBeenCalledWith(USER_ID, id);
    });
  });
});
