import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

import { DownloadsService } from './downloads.service';
import { DownloadRecord } from './entities/download-record.entity';
import { Song } from '../songs/entities/song.entity';
import { SongEncryptionKey } from '../songs/entities/song-encryption-key.entity';
import { User } from '../auth/entities/user.entity';
import { StorageService } from '../storage/storage.service';
import { Role, SongStatus } from '../../common/enums';

const mockRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  count: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  increment: jest.fn(),
  decrement: jest.fn(),
});

const mockUser: Partial<User> = {
  id: 'user-1',
  email: 'test@example.com',
  roles: [Role.USER, Role.PREMIUM],
  premiumExpiresAt: new Date(Date.now() + 86400000 * 30),
  get isPremium() { return true; },
};

const mockSong: Partial<Song> = {
  id: 'song-1',
  title: 'Test Song',
  status: SongStatus.LIVE,
  encryptedFileUrl: 's3://audio-enc/song-1.enc',
  coverArtUrl: null,
};

const mockKey: Partial<SongEncryptionKey> = {
  songId: 'song-1',
  aesKey: 'base64encodedkey==',
  iv: 'base64encodediv=',
};

describe('DownloadsService', () => {
  let service: DownloadsService;
  let downloadRepo: ReturnType<typeof mockRepo>;
  let songRepo: ReturnType<typeof mockRepo>;
  let keyRepo: ReturnType<typeof mockRepo>;
  let userRepo: ReturnType<typeof mockRepo>;
  let storageService: { presignedGetObject: jest.Mock };

  beforeEach(async () => {
    downloadRepo = mockRepo();
    songRepo = mockRepo();
    keyRepo = mockRepo();
    userRepo = mockRepo();
    storageService = { presignedGetObject: jest.fn().mockResolvedValue('https://minio/enc/song-1.enc?sig=abc') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DownloadsService,
        { provide: getRepositoryToken(DownloadRecord), useValue: downloadRepo },
        { provide: getRepositoryToken(Song), useValue: songRepo },
        { provide: getRepositoryToken(SongEncryptionKey), useValue: keyRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: StorageService, useValue: storageService },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('test_download_secret_32_chars_min') },
        },
      ],
    }).compile();

    service = module.get<DownloadsService>(DownloadsService);
  });

  describe('downloadSong', () => {
    it('returns downloadUrl and licenseJwt for a PREMIUM user', async () => {
      userRepo.findOne.mockResolvedValue(mockUser);
      songRepo.findOne.mockResolvedValue(mockSong);
      keyRepo.findOne.mockResolvedValue(mockKey);
      downloadRepo.count.mockResolvedValue(5);
      downloadRepo.findOne.mockResolvedValue(null);
      downloadRepo.create.mockReturnValue({});
      downloadRepo.save.mockResolvedValue({});
      userRepo.increment = jest.fn();

      const result = await service.downloadSong('user-1', 'song-1');

      expect(result.downloadUrl).toContain('minio');
      expect(result.licenseJwt).toBeTruthy();
      expect(storageService.presignedGetObject).toHaveBeenCalledWith('audio-enc', 'song-1.enc', 300);
    });

    it('throws ForbiddenException when user is not PREMIUM', async () => {
      userRepo.findOne.mockResolvedValue({
        ...mockUser,
        roles: [Role.USER],
        isPremium: false,
      });

      await expect(service.downloadSong('user-1', 'song-1')).rejects.toThrow('Premium subscription required');
    });

    it('throws UnprocessableEntityException when song is not LIVE', async () => {
      userRepo.findOne.mockResolvedValue(mockUser);
      songRepo.findOne.mockResolvedValue({ ...mockSong, status: SongStatus.PENDING });

      await expect(service.downloadSong('user-1', 'song-1')).rejects.toThrow('Only LIVE songs');
    });

    it('throws ForbiddenException when quota is reached', async () => {
      userRepo.findOne.mockResolvedValue(mockUser);
      songRepo.findOne.mockResolvedValue(mockSong);
      downloadRepo.count.mockResolvedValue(100); // at USER limit

      await expect(service.downloadSong('user-1', 'song-1')).rejects.toThrow('Download quota reached');
    });

    it('ADMIN bypasses PREMIUM check and quota', async () => {
      userRepo.findOne.mockResolvedValue({ ...mockUser, roles: [Role.ADMIN] });
      songRepo.findOne.mockResolvedValue(mockSong);
      keyRepo.findOne.mockResolvedValue(mockKey);
      downloadRepo.findOne.mockResolvedValue(null);
      downloadRepo.create.mockReturnValue({});
      downloadRepo.save.mockResolvedValue({});
      userRepo.increment = jest.fn();

      const result = await service.downloadSong('user-1', 'song-1');
      expect(result.downloadUrl).toBeTruthy();
      // count() should NOT be called for ADMIN
      expect(downloadRepo.count).not.toHaveBeenCalled();
    });
  });

  describe('removeDownload', () => {
    it('sets revokedAt on existing record', async () => {
      downloadRepo.findOne.mockResolvedValue({ id: 'dl-1', revokedAt: null });
      downloadRepo.update.mockResolvedValue({});
      userRepo.decrement = jest.fn();

      await service.removeDownload('user-1', 'song-1');

      expect(downloadRepo.update).toHaveBeenCalledWith('dl-1', { revokedAt: expect.any(Date) });
    });

    it('is idempotent when record is already revoked', async () => {
      downloadRepo.findOne.mockResolvedValue({ id: 'dl-1', revokedAt: new Date() });

      await service.removeDownload('user-1', 'song-1');

      expect(downloadRepo.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when no record exists', async () => {
      downloadRepo.findOne.mockResolvedValue(null);
      await expect(service.removeDownload('user-1', 'song-1')).rejects.toThrow('Download record not found');
    });
  });
});
