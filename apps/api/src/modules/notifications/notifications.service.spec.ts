import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { Notification } from './entities/notification.entity';
import { NotificationType } from '../../common/enums';

const makeRepo = () => ({
  save: jest.fn(),
  create: jest.fn((data) => data),
  findAndCount: jest.fn(),
  count: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
});

describe('NotificationsService', () => {
  let service: NotificationsService;
  let repo: ReturnType<typeof makeRepo>;

  beforeEach(async () => {
    repo = makeRepo();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: getRepositoryToken(Notification), useValue: repo },
      ],
    }).compile();
    service = module.get(NotificationsService);
  });

  describe('create', () => {
    it('saves a notification with auto-generated title and body', async () => {
      await service.create('user-1', NotificationType.SONG_APPROVED, {
        songTitle: 'My Track',
      });
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          type: NotificationType.SONG_APPROVED,
          title: 'Song Approved',
          body: '"My Track" is now live.',
        }),
      );
    });
  });

  describe('findAll', () => {
    it('returns paginated notifications for the user', async () => {
      const fakeNotif = { id: 'n-1', isRead: false };
      repo.findAndCount.mockResolvedValue([[fakeNotif], 1]);

      const result = await service.findAll('user-1', { page: 1, size: 20 });

      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1' } }),
      );
      expect(result).toEqual({ items: [fakeNotif], totalItems: 1, page: 1, size: 20, totalPages: 1 });
    });
  });

  describe('getUnreadCount', () => {
    it('returns count of unread notifications', async () => {
      repo.count.mockResolvedValue(3);
      const result = await service.getUnreadCount('user-1');
      expect(result).toEqual({ count: 3 });
      expect(repo.count).toHaveBeenCalledWith({ where: { userId: 'user-1', isRead: false } });
    });
  });

  describe('markRead', () => {
    it('sets isRead=true and readAt for an unread notification', async () => {
      repo.findOne.mockResolvedValue({ id: 'n-1', userId: 'user-1', isRead: false });
      await service.markRead('user-1', 'n-1');
      expect(repo.update).toHaveBeenCalledWith(
        { id: 'n-1', userId: 'user-1' },
        expect.objectContaining({ isRead: true }),
      );
    });

    it('is a no-op if the notification is already read', async () => {
      repo.findOne.mockResolvedValue({ id: 'n-1', userId: 'user-1', isRead: true });
      await service.markRead('user-1', 'n-1');
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when notification does not belong to user', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.markRead('user-1', 'n-999')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('markAllRead', () => {
    it('updates all unread notifications for the user', async () => {
      repo.update.mockResolvedValue({ affected: 5 });
      await service.markAllRead('user-1');
      expect(repo.update).toHaveBeenCalledWith(
        { userId: 'user-1', isRead: false },
        expect.objectContaining({ isRead: true }),
      );
    });
  });
});
