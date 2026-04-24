import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { DataSource } from 'typeorm';
import { AdminService } from './admin.service';
import { Song } from '../songs/entities/song.entity';
import { User } from '../auth/entities/user.entity';
import { Session } from '../auth/entities/session.entity';
import { PaymentRecord } from '../payments/entities/payment-record.entity';
import { DownloadRecord } from '../downloads/entities/download-record.entity';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../mail/mail.service';
import { GenresService } from '../genres/genres.service';
import { SongsService } from '../songs/songs.service';
import { DropsService } from '../drops/drops.service';
import { ReportsService } from '../reports/reports.service';
import { PaymentsService } from '../payments/payments.service';
import { QUEUE_NAMES } from '../queue/queue.constants';
import { Role, SongStatus } from '../../common/enums';

const mockRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  count: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
  createQueryBuilder: jest.fn().mockReturnValue({
    leftJoin: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    getRawAndEntities: jest.fn().mockResolvedValue([{ items: [], raw: [] }, 0]),
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
    createQueryBuilder: jest.fn().mockReturnValue({
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn(),
    }),
  },
};

describe('AdminService', () => {
  let service: AdminService;
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: getRepositoryToken(Song),          useFactory: mockRepo },
        { provide: getRepositoryToken(User),          useFactory: mockRepo },
        { provide: getRepositoryToken(Session),       useFactory: mockRepo },
        { provide: getRepositoryToken(PaymentRecord), useFactory: mockRepo },
        { provide: getRepositoryToken(DownloadRecord),useFactory: mockRepo },
        { provide: DataSource, useValue: { createQueryRunner: () => mockQueryRunner } },
        { provide: AuditService,         useValue: { log: jest.fn(), findAllPaginated: jest.fn().mockResolvedValue({ items: [], totalItems: 0, page: 1, size: 20, totalPages: 0 }) } },
        { provide: NotificationsService, useValue: { create: jest.fn() } },
        { provide: MailService,          useValue: { songApprovedEmail: jest.fn().mockReturnValue(''), songRejectedEmail: jest.fn().mockReturnValue(''), songReuploadRequiredEmail: jest.fn().mockReturnValue(''), songRestoredEmail: jest.fn().mockReturnValue('') } },
        { provide: GenresService,        useValue: { findAllSuggestions: jest.fn(), approveSuggestion: jest.fn(), rejectSuggestion: jest.fn() } },
        { provide: SongsService,         useValue: { buildSongResponse: jest.fn((s) => s) } },
        { provide: DropsService,         useValue: { enqueueDropJobs: jest.fn() } },
        { provide: ReportsService,       useValue: { findAllAdmin: jest.fn(), dismiss: jest.fn(), takedown: jest.fn() } },
        { provide: PaymentsService,      useValue: { adminGrantPremiumByDays: jest.fn(), adminRevokePremium: jest.fn() } },
        { provide: getQueueToken(QUEUE_NAMES.EMAIL), useValue: { add: jest.fn() } },
      ],
    }).compile();

    service = module.get(AdminService);
  });

  describe('listUsers', () => {
    it('returns paginated user list', async () => {
      const userRepo = module.get(getRepositoryToken(User));
      const qb = userRepo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([
        [{ id: 'u1', email: 'a@b.com', name: 'A', roles: [Role.USER], premiumExpiresAt: null, createdAt: new Date() }],
        1,
      ]);

      const result = await service.listUsers({ page: 1, size: 20 });
      expect(result.totalItems).toBe(1);
      expect(result.items[0].email).toBe('a@b.com');
    });
  });

  describe('getUserDetail', () => {
    it('returns full user detail including session and download counts', async () => {
      const userRepo = module.get(getRepositoryToken(User));
      userRepo.findOne.mockResolvedValue({
        id: 'u1', email: 'a@b.com', name: 'A',
        roles: [Role.USER], premiumExpiresAt: null, createdAt: new Date(),
        failedAttempts: 0, lockUntil: null, isPremium: false,
      });

      const sessionRepo = module.get(getRepositoryToken(Session));
      sessionRepo.count.mockResolvedValue(2);

      const downloadRepo = module.get(getRepositoryToken(DownloadRecord));
      downloadRepo.count.mockResolvedValue(5);

      const result = await service.getUserDetail('u1');
      expect(result.sessionCount).toBe(2);
      expect(result.downloadCount).toBe(5);
    });

    it('throws NotFoundException for unknown userId', async () => {
      const userRepo = module.get(getRepositoryToken(User));
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.getUserDetail('unknown')).rejects.toThrow('User not found');
    });
  });

  describe('updateUserRoles', () => {
    it('throws ForbiddenException when admin removes own ADMIN role', async () => {
      const userRepo = module.get(getRepositoryToken(User));
      userRepo.findOne.mockResolvedValue({ id: 'admin-1', roles: [Role.ADMIN, Role.USER], isPremium: false });

      await expect(
        service.updateUserRoles('admin-1', 'admin-1', { roles: [Role.USER] }),
      ).rejects.toThrow('Cannot remove ADMIN role from yourself');
    });

    it('ensures USER role is always present', async () => {
      const userRepo = module.get(getRepositoryToken(User));
      userRepo.findOne
        .mockResolvedValueOnce({ id: 'u1', roles: [Role.USER], isPremium: false })
        .mockResolvedValueOnce({ id: 'u1', roles: [Role.USER, Role.ARTIST], premiumExpiresAt: null, email: 'a@b.com', name: 'A', createdAt: new Date(), isPremium: false });

      await service.updateUserRoles('admin-1', 'u1', { roles: [Role.ARTIST] });

      expect(mockQueryRunner.manager.update).toHaveBeenCalledWith(
        User, 'u1', expect.objectContaining({ roles: expect.arrayContaining([Role.USER]) }),
      );
    });
  });

  describe('deleteUserSession', () => {
    it('soft-deletes the session', async () => {
      const sessionRepo = module.get(getRepositoryToken(Session));
      sessionRepo.findOne.mockResolvedValue({ id: 's1', userId: 'u1' });

      await service.deleteUserSession('u1', 's1');
      expect(sessionRepo.softDelete).toHaveBeenCalledWith('s1');
    });

    it('throws NotFoundException for unknown sessionId', async () => {
      const sessionRepo = module.get(getRepositoryToken(Session));
      sessionRepo.findOne.mockResolvedValue(null);
      await expect(service.deleteUserSession('u1', 'unknown')).rejects.toThrow('Session not found');
    });
  });

  describe('adminGrantPremium', () => {
    it('delegates to PaymentsService and logs audit', async () => {
      const paymentsService = module.get(PaymentsService);
      const auditService    = module.get(AuditService);

      await service.adminGrantPremium('admin-1', { userId: 'u1', durationDays: 30 });

      expect(paymentsService.adminGrantPremiumByDays).toHaveBeenCalledWith('u1', 30);
      expect(auditService.log).toHaveBeenCalledWith('admin-1', 'PREMIUM_GRANTED', 'USER', 'u1', undefined);
    });
  });
});
