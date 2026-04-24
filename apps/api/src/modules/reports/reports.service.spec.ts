import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { DataSource } from 'typeorm';
import { ReportsService } from './reports.service';
import { Report } from './entities/report.entity';
import { Song } from '../songs/entities/song.entity';
import { Playlist } from '../playlists/entities/playlist.entity';
import { User } from '../auth/entities/user.entity';
import { ArtistProfile } from '../auth/entities/artist-profile.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../mail/mail.service';
import { QUEUE_NAMES } from '../queue/queue.constants';
import { ContentTargetType, ReportReason, ReportStatus, SongStatus } from '../../common/enums';

const mockRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  createQueryBuilder: jest.fn().mockReturnValue({
    leftJoin: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  }),
});

const mockQueryRunner = {
  connect: jest.fn(),
  startTransaction: jest.fn(),
  commitTransaction: jest.fn(),
  rollbackTransaction: jest.fn(),
  release: jest.fn(),
  manager: {
    update: jest.fn(),
    delete: jest.fn(),
    findOne: jest.fn(),
  },
};

describe('ReportsService', () => {
  let service: ReportsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: getRepositoryToken(Report),        useFactory: mockRepo },
        { provide: getRepositoryToken(Song),          useFactory: mockRepo },
        { provide: getRepositoryToken(Playlist),      useFactory: mockRepo },
        { provide: getRepositoryToken(User),          useFactory: mockRepo },
        { provide: getRepositoryToken(ArtistProfile), useFactory: mockRepo },
        { provide: DataSource, useValue: { createQueryRunner: () => mockQueryRunner } },
        { provide: NotificationsService, useValue: { create: jest.fn() } },
        { provide: MailService, useValue: { songTakenDownEmail: jest.fn().mockReturnValue('') } },
        { provide: getQueueToken(QUEUE_NAMES.EMAIL), useValue: { add: jest.fn() } },
      ],
    }).compile();

    service = module.get(ReportsService);
  });

  describe('create', () => {
    it('creates a new report when none exists for the (reporter, target) pair', async () => {
      const songRepo = module.get(getRepositoryToken(Song));
      songRepo.findOne.mockResolvedValue({ id: 'song-1', userId: 'other-user', status: SongStatus.LIVE });

      const reportsRepo = module.get(getRepositoryToken(Report));
      reportsRepo.findOne
        .mockResolvedValueOnce(null)    // no existing report
        .mockResolvedValueOnce({ id: 'report-1' }); // return after save
      reportsRepo.create.mockReturnValue({ reason: ReportReason.EXPLICIT });
      reportsRepo.save.mockResolvedValue({ id: 'report-1' });

      const result = await service.create('reporter-1', {
        targetType: ContentTargetType.SONG,
        targetId: 'song-1',
        reason: ReportReason.EXPLICIT,
      });

      expect(reportsRepo.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('upserts reason when a report already exists', async () => {
      const songRepo = module.get(getRepositoryToken(Song));
      songRepo.findOne.mockResolvedValue({ id: 'song-1', userId: 'other-user', status: SongStatus.LIVE });

      const reportsRepo = module.get(getRepositoryToken(Report));
      reportsRepo.findOne
        .mockResolvedValueOnce({ id: 'existing-report', status: ReportStatus.PENDING })
        .mockResolvedValueOnce({ id: 'existing-report', reason: ReportReason.COPYRIGHT });

      const result = await service.create('reporter-1', {
        targetType: ContentTargetType.SONG,
        targetId: 'song-1',
        reason: ReportReason.COPYRIGHT,
      });

      expect(reportsRepo.update).toHaveBeenCalledWith('existing-report', expect.objectContaining({
        reason: ReportReason.COPYRIGHT,
        status: ReportStatus.PENDING,
      }));
    });

    it('throws ForbiddenException when reporter is the content owner', async () => {
      const songRepo = module.get(getRepositoryToken(Song));
      songRepo.findOne
        .mockResolvedValueOnce({ id: 'song-1', userId: 'reporter-1', status: SongStatus.LIVE })
        .mockResolvedValueOnce({ id: 'song-1', userId: 'reporter-1' });

      await expect(
        service.create('reporter-1', {
          targetType: ContentTargetType.SONG,
          targetId: 'song-1',
          reason: ReportReason.EXPLICIT,
        }),
      ).rejects.toThrow('Cannot report your own content');
    });
  });

  describe('dismiss', () => {
    it('transitions a PENDING report to DISMISSED', async () => {
      const reportsRepo = module.get(getRepositoryToken(Report));
      reportsRepo.findOne
        .mockResolvedValueOnce({ id: 'r1', status: ReportStatus.PENDING })
        .mockResolvedValueOnce({ id: 'r1', status: ReportStatus.DISMISSED });

      const result = await service.dismiss('admin-1', 'r1', { notes: 'no violation' });

      expect(reportsRepo.update).toHaveBeenCalledWith('r1', expect.objectContaining({
        status: ReportStatus.DISMISSED,
        resolvedById: 'admin-1',
      }));
    });

    it('throws UnprocessableEntityException if report is already resolved', async () => {
      const reportsRepo = module.get(getRepositoryToken(Report));
      reportsRepo.findOne.mockResolvedValue({ id: 'r1', status: ReportStatus.RESOLVED });

      await expect(service.dismiss('admin-1', 'r1', {})).rejects.toThrow();
    });
  });

  describe('takedown', () => {
    it('resolves a SONG report and sets song status to TAKEN_DOWN', async () => {
      const reportsRepo = module.get(getRepositoryToken(Report));
      reportsRepo.findOne
        .mockResolvedValueOnce({
          id: 'r1',
          status: ReportStatus.PENDING,
          targetType: ContentTargetType.SONG,
          targetId: 'song-1',
        })
        .mockResolvedValueOnce({ id: 'r1', status: ReportStatus.RESOLVED });

      mockQueryRunner.manager.findOne.mockResolvedValue({ id: 'song-1', userId: 'artist-1' });

      const songsRepo = module.get(getRepositoryToken(Song));
      songsRepo.findOne.mockResolvedValue(null); // for notification step

      await service.takedown('admin-1', 'r1', {});

      expect(mockQueryRunner.manager.update).toHaveBeenCalledWith(
        Report, 'r1', expect.objectContaining({ status: ReportStatus.RESOLVED }),
      );
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });
  });

  // Needed for the `module` reference in tests above — keep module ref accessible
  let module: TestingModule;
  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: getRepositoryToken(Report),        useFactory: mockRepo },
        { provide: getRepositoryToken(Song),          useFactory: mockRepo },
        { provide: getRepositoryToken(Playlist),      useFactory: mockRepo },
        { provide: getRepositoryToken(User),          useFactory: mockRepo },
        { provide: getRepositoryToken(ArtistProfile), useFactory: mockRepo },
        { provide: DataSource, useValue: { createQueryRunner: () => mockQueryRunner } },
        { provide: NotificationsService, useValue: { create: jest.fn() } },
        { provide: MailService, useValue: { songTakenDownEmail: jest.fn().mockReturnValue('') } },
        { provide: getQueueToken(QUEUE_NAMES.EMAIL), useValue: { add: jest.fn() } },
      ],
    }).compile();
    service = module.get(ReportsService);
  });
});
