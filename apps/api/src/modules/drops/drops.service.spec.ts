import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { DropsService } from './drops.service';
import { Song } from '../songs/entities/song.entity';
import { DropNotification } from './entities/drop-notification.entity';
import { Follow } from '../follow/entities/follow.entity';
import { User } from '../auth/entities/user.entity';
import { ArtistProfile } from '../auth/entities/artist-profile.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { FeedService } from '../feed/feed.service';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { StorageService } from '../storage/storage.service';
import { QUEUE_NAMES } from '../queue/queue.constants';
import { SongStatus, Role } from '../../common/enums';

const makeRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  createQueryBuilder: jest.fn().mockReturnValue({
    insert: jest.fn().mockReturnThis(),
    into: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    orIgnore: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({}),
  }),
});

const makeQueueMock = () => ({
  add: jest.fn().mockResolvedValue({ id: 'job-1' }),
  remove: jest.fn().mockResolvedValue(undefined),
});

const makeQueryRunner = () => ({
  connect: jest.fn(),
  startTransaction: jest.fn(),
  commitTransaction: jest.fn(),
  rollbackTransaction: jest.fn(),
  release: jest.fn(),
  manager: {
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    save: jest.fn().mockImplementation((_entity, data) => data),
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn((_entity, data) => data),
    delete: jest.fn(),
  },
});

const SCHEDULED_SONG: Partial<Song> = {
  id: 'song-1',
  userId: 'artist-1',
  title: 'Test Drop',
  status: SongStatus.SCHEDULED,
  dropAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
  dropJob24hId: 'job-24h',
  dropJob1hId: 'job-1h',
  hasRescheduled: false,
};

describe('DropsService', () => {
  let service: DropsService;
  let songRepo: ReturnType<typeof makeRepo>;
  let dropNotifRepo: ReturnType<typeof makeRepo>;
  let dropQueue: ReturnType<typeof makeQueueMock>;
  let emailQueue: ReturnType<typeof makeQueueMock>;
  let mockDataSource: { createQueryRunner: jest.Mock };
  let mockNotificationsService: { create: jest.Mock };
  let mockStorageService: { getPublicUrl: jest.Mock; getBuckets: jest.Mock };

  beforeEach(async () => {
    songRepo = makeRepo();
    dropNotifRepo = makeRepo();
    dropQueue = makeQueueMock();
    emailQueue = makeQueueMock();
    const qr = makeQueryRunner();
    mockDataSource = { createQueryRunner: jest.fn().mockReturnValue(qr) };
    mockNotificationsService = { create: jest.fn().mockResolvedValue(undefined) };
    mockStorageService = {
      getPublicUrl: jest.fn().mockReturnValue('https://cdn/cover.jpg'),
      getBuckets: jest.fn().mockReturnValue({ images: 'images', audio: 'audio' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DropsService,
        { provide: getRepositoryToken(Song), useValue: songRepo },
        { provide: getRepositoryToken(DropNotification), useValue: dropNotifRepo },
        { provide: getRepositoryToken(Follow), useValue: makeRepo() },
        { provide: getRepositoryToken(User), useValue: makeRepo() },
        { provide: getRepositoryToken(ArtistProfile), useValue: makeRepo() },
        { provide: getRepositoryToken(Notification), useValue: makeRepo() },
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: FeedService, useValue: { createEvent: jest.fn() } },
        { provide: AuditService, useValue: { log: jest.fn() } },
        { provide: MailService, useValue: { dropCancelledEmail: jest.fn().mockReturnValue('<p>cancelled</p>'), dropRescheduledEmail: jest.fn().mockReturnValue('<p>rescheduled</p>') } },
        { provide: StorageService, useValue: mockStorageService },
        { provide: getQueueToken(QUEUE_NAMES.DROP_NOTIFICATION), useValue: dropQueue },
        { provide: getQueueToken(QUEUE_NAMES.EMAIL), useValue: emailQueue },
        { provide: getDataSourceToken(), useValue: mockDataSource },
      ],
    }).compile();

    service = module.get(DropsService);
  });

  describe('getTeaser', () => {
    it('returns teaser DTO for a SCHEDULED song', async () => {
      songRepo.findOne.mockResolvedValue({ ...SCHEDULED_SONG, coverArtUrl: 'cover.jpg' });
      const artistProfileRepo = (service as any).artistProfiles as ReturnType<typeof makeRepo>;
      artistProfileRepo.findOne = jest.fn().mockResolvedValue({ stageName: 'DJ Test' });

      const result = await service.getTeaser('song-1');

      expect(result.id).toBe('song-1');
      expect(result.artistName).toBe('DJ Test');
      expect(result.teaserText).toMatch(/DJ Test · drops in/);
    });

    it('throws NotFoundException when song is not SCHEDULED', async () => {
      songRepo.findOne.mockResolvedValue(null);
      await expect(service.getTeaser('song-99')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('optIn', () => {
    it('upserts a drop notification record', async () => {
      songRepo.findOne.mockResolvedValue({ id: 'song-1', status: SongStatus.SCHEDULED });
      await service.optIn('user-1', 'song-1');
      expect(dropNotifRepo.createQueryBuilder).toHaveBeenCalled();
    });

    it('throws NotFoundException when song is not SCHEDULED', async () => {
      songRepo.findOne.mockResolvedValue(null);
      await expect(service.optIn('user-1', 'bad-song')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('optOut', () => {
    it('deletes the drop notification record', async () => {
      await service.optOut('user-1', 'song-1');
      expect(dropNotifRepo.delete).toHaveBeenCalledWith({ userId: 'user-1', songId: 'song-1' });
    });
  });

  describe('cancelDrop', () => {
    it('sets status to APPROVED and clears dropAt', async () => {
      songRepo.findOne.mockResolvedValue({ ...SCHEDULED_SONG });
      dropNotifRepo.find.mockResolvedValue([]);

      await service.cancelDrop('artist-1', 'song-1', [Role.ARTIST]);

      expect(songRepo.update).toHaveBeenCalledWith(
        'song-1',
        expect.objectContaining({ status: SongStatus.APPROVED, dropAt: null }),
      );
    });

    it('throws BadRequestException when song is not SCHEDULED', async () => {
      songRepo.findOne.mockResolvedValue({ ...SCHEDULED_SONG, status: SongStatus.LIVE });
      await expect(service.cancelDrop('artist-1', 'song-1', [Role.ARTIST])).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('throws ForbiddenException when user does not own the song', async () => {
      songRepo.findOne.mockResolvedValue({ ...SCHEDULED_SONG });
      await expect(service.cancelDrop('other-user', 'song-1', [Role.ARTIST])).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('admin can cancel any song', async () => {
      songRepo.findOne.mockResolvedValue({ ...SCHEDULED_SONG });
      dropNotifRepo.find.mockResolvedValue([]);
      await expect(service.cancelDrop('admin-id', 'song-1', [Role.ADMIN])).resolves.not.toThrow();
    });
  });

  describe('rescheduleDrop', () => {
    const futureDropAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days

    it('updates dropAt and sets hasRescheduled=true', async () => {
      songRepo.findOne.mockResolvedValue({ ...SCHEDULED_SONG });
      songRepo.save.mockResolvedValue({ ...SCHEDULED_SONG, dropAt: futureDropAt, hasRescheduled: true });
      dropNotifRepo.find.mockResolvedValue([]);

      await service.rescheduleDrop('artist-1', 'song-1', { dropAt: futureDropAt }, [Role.ARTIST]);

      expect(songRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ hasRescheduled: true, dropAt: futureDropAt }),
      );
    });

    it('throws ForbiddenException if song has already been rescheduled', async () => {
      songRepo.findOne.mockResolvedValue({ ...SCHEDULED_SONG, hasRescheduled: true });
      await expect(
        service.rescheduleDrop('artist-1', 'song-1', { dropAt: futureDropAt }, [Role.ARTIST]),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws UnprocessableEntityException when new dropAt is less than 1 hour from now', async () => {
      songRepo.findOne.mockResolvedValue({ ...SCHEDULED_SONG });
      const tooSoon = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
      await expect(
        service.rescheduleDrop('artist-1', 'song-1', { dropAt: tooSoon }, [Role.ARTIST]),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('throws UnprocessableEntityException when new dropAt exceeds 90 days', async () => {
      songRepo.findOne.mockResolvedValue({ ...SCHEDULED_SONG });
      const tooFar = new Date(Date.now() + 91 * 24 * 60 * 60 * 1000);
      await expect(
        service.rescheduleDrop('artist-1', 'song-1', { dropAt: tooFar }, [Role.ARTIST]),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });
  });

  describe('enqueueDropJobs', () => {
    it('enqueues both delayed BullMQ jobs and stores IDs on the song', async () => {
      const song = { ...SCHEDULED_SONG, dropJob24hId: null, dropJob1hId: null } as Song;
      dropQueue.add
        .mockResolvedValueOnce({ id: 'j-24h' })
        .mockResolvedValueOnce({ id: 'j-1h' });

      await service.enqueueDropJobs(song);

      expect(dropQueue.add).toHaveBeenCalledWith('drop-notify-24h', { songId: 'song-1' }, expect.any(Object));
      expect(dropQueue.add).toHaveBeenCalledWith('drop-notify-1h', { songId: 'song-1' }, expect.any(Object));
      expect(songRepo.update).toHaveBeenCalledWith('song-1', { dropJob24hId: 'j-24h', dropJob1hId: 'j-1h' });
    });

    it('skips 24h job when drop is less than 24h away', async () => {
      const nearSoon = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2h from now
      const song = { ...SCHEDULED_SONG, dropAt: nearSoon, dropJob24hId: null, dropJob1hId: null } as Song;
      dropQueue.add.mockResolvedValueOnce({ id: 'j-1h' });

      await service.enqueueDropJobs(song);

      // Only 1h job should be added (24h window has passed)
      expect(dropQueue.add).toHaveBeenCalledTimes(1);
      expect(dropQueue.add).toHaveBeenCalledWith('drop-notify-1h', expect.any(Object), expect.any(Object));
    });
  });

  describe('fireDueDrops (cron)', () => {
    it('finds SCHEDULED songs past dropAt and fires each', async () => {
      const dueSong = { ...SCHEDULED_SONG, status: SongStatus.SCHEDULED } as Song;
      songRepo.find.mockResolvedValue([dueSong]);

      await service.fireDueDrops();

      // QueryRunner should have been used
      expect(mockDataSource.createQueryRunner).toHaveBeenCalled();
    });

    it('silently catches errors per song without crashing the cron', async () => {
      songRepo.find.mockResolvedValue([{ ...SCHEDULED_SONG } as Song]);
      mockDataSource.createQueryRunner.mockReturnValue({
        connect: jest.fn(),
        startTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
        manager: {
          update: jest.fn().mockRejectedValue(new Error('DB error')),
          create: jest.fn(),
        },
        commitTransaction: jest.fn(),
      });

      await expect(service.fireDueDrops()).resolves.not.toThrow();
    });
  });
});
