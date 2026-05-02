import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import { Song } from '../songs/entities/song.entity';
import { ArtistProfile } from '../auth/entities/artist-profile.entity';
import { User } from '../auth/entities/user.entity';
import { Session } from '../auth/entities/session.entity';
import { PaymentRecord } from '../payments/entities/payment-record.entity';
import { DownloadRecord } from '../downloads/entities/download-record.entity';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../mail/mail.service';
import { GenresService } from '../genres/genres.service';
import { SongsService } from '../songs/songs.service';
import { ReportsService } from '../reports/reports.service';
import { PaymentsService } from '../payments/payments.service';
import { NotificationType, PaymentStatus, Role, SongStatus } from '../../common/enums';
import { QUEUE_NAMES } from '../queue/queue.constants';
import { DropsService } from '../drops/drops.service';
import { RejectSongDto } from './dto/reject-song.dto';
import { ReuploadRequiredDto } from './dto/reupload-required.dto';
import { RejectGenreSuggestionDto } from './dto/reject-genre-suggestion.dto';
import { AdminUserQueryDto } from './dto/admin-user-query.dto';
import { UpdateUserRolesDto } from './dto/update-user-roles.dto';
import { AdminPaymentQueryDto } from './dto/admin-payment-query.dto';
import { AdminSongQueryDto } from './dto/admin-song-query.dto';
import { AdminGrantPremiumDto } from './dto/admin-grant-premium.dto';
import { AdminRevokePremiumDto } from './dto/admin-revoke-premium.dto';
import { CreateOfficialArtistDto } from './dto/create-official-artist.dto';
import { UpdateOfficialArtistDto } from './dto/update-official-artist.dto';
import { UpdateSongStatusDto } from './dto/update-song-status.dto';
import { AdminUploadSongDto } from '../songs/dto/admin-upload-song.dto';
import { ReportAdminQueryDto } from '../reports/dto/report-admin-query.dto';
import { ResolveReportDto } from '../reports/dto/resolve-report.dto';
import { StorageService } from '../storage/storage.service';

const ALLOWED_APPROVE_STATUSES = new Set([SongStatus.PENDING]);
const ALLOWED_REJECT_STATUSES = new Set([SongStatus.PENDING]);
const ALLOWED_REUPLOAD_STATUSES = new Set([SongStatus.PENDING]);
const ALLOWED_RESTORE_STATUSES = new Set([SongStatus.TAKEN_DOWN]);

const STATUS_TRANSITIONS: Partial<Record<SongStatus, Set<SongStatus>>> = {
  [SongStatus.PENDING]: new Set([SongStatus.LIVE, SongStatus.SCHEDULED, SongStatus.REJECTED, SongStatus.REUPLOAD_REQUIRED]),
  [SongStatus.APPROVED]: new Set([SongStatus.LIVE, SongStatus.SCHEDULED, SongStatus.REJECTED, SongStatus.REUPLOAD_REQUIRED]),
  [SongStatus.LIVE]: new Set([SongStatus.TAKEN_DOWN]),
  [SongStatus.TAKEN_DOWN]: new Set([SongStatus.LIVE]),
  [SongStatus.REJECTED]: new Set([SongStatus.LIVE, SongStatus.PENDING]),
  [SongStatus.REUPLOAD_REQUIRED]: new Set([SongStatus.PENDING]),
  [SongStatus.SCHEDULED]: new Set([SongStatus.LIVE, SongStatus.TAKEN_DOWN]),
};

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Song) private readonly songs: Repository<Song>,
    @InjectRepository(ArtistProfile) private readonly artistProfiles: Repository<ArtistProfile>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Session) private readonly sessions: Repository<Session>,
    @InjectRepository(PaymentRecord) private readonly paymentRecords: Repository<PaymentRecord>,
    @InjectRepository(DownloadRecord) private readonly downloadRecords: Repository<DownloadRecord>,
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly mailService: MailService,
    private readonly genresService: GenresService,
    private readonly songsService: SongsService,
    private readonly dropsService: DropsService,
    private readonly reportsService: ReportsService,
    private readonly paymentsService: PaymentsService,
    private readonly storage: StorageService,
    @InjectQueue(QUEUE_NAMES.EMAIL) private readonly emailQueue: Queue,
  ) { }

  // ════════════════════════════════════════════════════════════════════════════
  // Phase 4B — Song approval (unchanged)
  // ════════════════════════════════════════════════════════════════════════════

  async getSongApprovalQueue() {
    const songs = await this.songs.find({
      where: { status: SongStatus.PENDING },
      order: { createdAt: 'ASC' },
    });
    return Promise.all(songs.map((s) => this.songsService.buildSongResponse(s)));
  }

  async approveSong(adminId: string, songId: string) {
    const song = await this.findSongOrThrow(songId);

    if (!ALLOWED_APPROVE_STATUSES.has(song.status)) {
      throw new BadRequestException(`Cannot approve a song with status "${song.status}"`);
    }

    song.status = song.dropAt && song.dropAt > new Date() ? SongStatus.SCHEDULED : SongStatus.LIVE;
    await this.songs.save(song);

    if (song.status === SongStatus.SCHEDULED) {
      await this.dropsService.enqueueDropJobs(song);
    }

    await this.auditService.log(adminId, 'SONG_APPROVED', 'SONG', songId);

    const artist = await this.users.findOne({ where: { id: song.userId } });
    if (artist) {
      await Promise.allSettled([
        this.notificationsService.create(artist.id, NotificationType.SONG_APPROVED, {
          songId,
          songTitle: song.title,
        }),
        this.emailQueue
          .add('send', {
            to: artist.email,
            subject: `Your song "${song.title}" has been approved`,
            html: this.mailService.songApprovedEmail(song.title),
          })
          .catch(() => undefined),
      ]);
    }

    return this.songsService.buildSongResponse(song);
  }

  async rejectSong(adminId: string, songId: string, dto: RejectSongDto) {
    const song = await this.findSongOrThrow(songId);

    if (!ALLOWED_REJECT_STATUSES.has(song.status)) {
      throw new BadRequestException(`Cannot reject a song with status "${song.status}"`);
    }

    song.status = SongStatus.REJECTED;
    song.rejectionReason = dto.reason;
    await this.songs.save(song);

    await this.auditService.log(adminId, 'SONG_REJECTED', 'SONG', songId, dto.reason);

    const artist = await this.users.findOne({ where: { id: song.userId } });
    if (artist) {
      await Promise.allSettled([
        this.notificationsService.create(artist.id, NotificationType.SONG_REJECTED, {
          songId,
          songTitle: song.title,
          reason: dto.reason,
        }),
        this.emailQueue
          .add('send', {
            to: artist.email,
            subject: `Song review update: "${song.title}"`,
            html: this.mailService.songRejectedEmail(song.title, dto.reason),
          })
          .catch(() => undefined),
      ]);
    }

    return this.songsService.buildSongResponse(song);
  }

  async requestReupload(adminId: string, songId: string, dto: ReuploadRequiredDto) {
    const song = await this.findSongOrThrow(songId);

    if (!ALLOWED_REUPLOAD_STATUSES.has(song.status)) {
      throw new BadRequestException(`Cannot request reupload for a song with status "${song.status}"`);
    }

    song.status = SongStatus.REUPLOAD_REQUIRED;
    song.reuploadReason = dto.notes;
    await this.songs.save(song);

    await this.auditService.log(adminId, 'SONG_REUPLOAD_REQUIRED', 'SONG', songId, dto.notes);

    const artist = await this.users.findOne({ where: { id: song.userId } });
    if (artist) {
      await Promise.allSettled([
        this.notificationsService.create(artist.id, NotificationType.SONG_REUPLOAD_REQUIRED, {
          songId,
          songTitle: song.title,
          notes: dto.notes,
        }),
        this.emailQueue
          .add('send', {
            to: artist.email,
            subject: `Action required for "${song.title}"`,
            html: this.mailService.songReuploadRequiredEmail(song.title, dto.notes),
          })
          .catch(() => undefined),
      ]);
    }

    return this.songsService.buildSongResponse(song);
  }

  async restoreSong(adminId: string, songId: string) {
    const song = await this.findSongOrThrow(songId);

    if (!ALLOWED_RESTORE_STATUSES.has(song.status)) {
      throw new BadRequestException(`Cannot restore a song with status "${song.status}"`);
    }

    song.status = SongStatus.LIVE;
    await this.songs.save(song);

    await this.auditService.log(adminId, 'SONG_RESTORED', 'SONG', songId);

    const artist = await this.users.findOne({ where: { id: song.userId } });
    if (artist) {
      await Promise.allSettled([
        this.notificationsService.create(artist.id, NotificationType.SONG_RESTORED, {
          songId,
          songTitle: song.title,
        }),
        this.emailQueue
          .add('send', {
            to: artist.email,
            subject: `Your song "${song.title}" has been restored`,
            html: this.mailService.songRestoredEmail(song.title),
          })
          .catch(() => undefined),
      ]);
    }

    return this.songsService.buildSongResponse(song);
  }

  findAllGenreSuggestions() {
    return this.genresService.findAllSuggestions();
  }

  async approveGenreSuggestion(adminId: string, suggestionId: string) {
    const result = await this.genresService.approveSuggestion(adminId, suggestionId);
    await this.auditService.log(adminId, 'GENRE_SUGGESTION_APPROVED', 'GENRE_SUGGESTION', suggestionId);
    return result;
  }

  async rejectGenreSuggestion(adminId: string, suggestionId: string, dto: RejectGenreSuggestionDto) {
    const result = await this.genresService.rejectSuggestion(adminId, suggestionId, dto.notes);
    await this.auditService.log(adminId, 'GENRE_SUGGESTION_REJECTED', 'GENRE_SUGGESTION', suggestionId, dto.notes);
    return result;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Phase 9 — Song admin list (BL-85)
  // ════════════════════════════════════════════════════════════════════════════

  async listSongsAdmin(query: AdminSongQueryDto) {
    const page = query.page ?? 1;
    const size = query.size ?? 20;
    const status = query.status; // undefined = no filter (all statuses)

    const qb = this.songs
      .createQueryBuilder('s')
      .leftJoin('artist_profiles', 'ap', 'ap.id::text = s.artist_profile_id::text')
      .leftJoin('users', 'u', 'u.id::text = s.user_id::text')
      .select([
        's.id',
        's.title',
        's.status',
        's.createdAt',
        's.dropAt',
        's.listenCount',
        's.coverArtUrl',
        'ap.stageName',
        'u.name',
      ])
      .orderBy('s.createdAt', 'DESC')
      .skip((page - 1) * size)
      .take(size);

    if (status) qb.andWhere('s.status = :status', { status });
    if (query.artistId) qb.andWhere('s.user_id = :artistId', { artistId: query.artistId });
    if (query.search) qb.andWhere('s.title ILIKE :search', { search: `%${query.search}%` });

    // Count query without pagination for totalItems
    const countQb = this.songs.createQueryBuilder('s');
    if (status) countQb.andWhere('s.status = :status', { status });
    if (query.artistId) countQb.andWhere('s.user_id = :artistId', { artistId: query.artistId });
    if (query.search) countQb.andWhere('s.title ILIKE :search', { search: `%${query.search}%` });
    const totalItems = await countQb.getCount();

    const { entities, raw } = await qb.getRawAndEntities();

    const items = entities.map((s, i) => ({
      id: s.id,
      title: s.title,
      artistName: (raw[i] as any)?.ap_stage_name ?? (raw[i] as any)?.u_name ?? null,
      coverArtUrl: s.coverArtUrl
        ? this.storage.getPublicUrl(this.storage.getBuckets().images, s.coverArtUrl)
        : null,
      status: s.status,
      createdAt: s.createdAt,
      dropAt: s.dropAt,
      totalPlays: s.listenCount,
      // energy intentionally excluded per locked decision
    }));

    return { items, totalItems, page, size, totalPages: Math.ceil(totalItems / size) };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Phase 9 — User management (BL-68–71)
  // ════════════════════════════════════════════════════════════════════════════

  async listUsers(query: AdminUserQueryDto) {
    const page = query.page ?? 1;
    const size = query.size ?? 20;

    const qb = this.users
      .createQueryBuilder('u')
      .select([
        'u.id',
        'u.email',
        'u.name',
        'u.roles',
        'u.premiumExpiresAt',
        'u.createdAt',
      ])
      .orderBy('u.createdAt', 'DESC')
      .skip((page - 1) * size)
      .take(size);

    if (query.role) {
      qb.andWhere('u.roles LIKE :role', { role: `%${query.role}%` });
    }
    if (query.search) {
      qb.andWhere('(u.email ILIKE :s OR u.name ILIKE :s)', { s: `%${query.search}%` });
    }

    const [items, totalItems] = await qb.getManyAndCount();

    return {
      items: items.map((u) => this.toUserSummaryDto(u)),
      totalItems,
      page,
      size,
      totalPages: Math.ceil(totalItems / size),
    };
  }

  async getUserDetail(targetUserId: string) {
    const user = await this.users.findOne({ where: { id: targetUserId } });
    if (!user) throw new NotFoundException('User not found');

    const [sessionCount, downloadCount] = await Promise.all([
      this.sessions.count({ where: { userId: targetUserId } }),
      this.downloadRecords.count({ where: { userId: targetUserId, revokedAt: null as any } }),
    ]);

    return {
      ...this.toUserSummaryDto(user),
      failedAttempts: user.failedAttempts,
      lockUntil: user.lockUntil,
      sessionCount,
      downloadCount,
    };
  }

  async updateUserRoles(
    currentAdminId: string,
    targetUserId: string,
    dto: UpdateUserRolesDto,
  ) {
    const user = await this.users.findOne({ where: { id: targetUserId } });
    if (!user) throw new NotFoundException('User not found');

    // Cannot demote own ADMIN role
    if (
      currentAdminId === targetUserId &&
      user.roles.includes(Role.ADMIN) &&
      !dto.roles.includes(Role.ADMIN)
    ) {
      throw new ForbiddenException('Cannot remove ADMIN role from yourself');
    }

    // Ensure USER is always present
    const newRoles = dto.roles.includes(Role.USER) ? dto.roles : [Role.USER, ...dto.roles];

    const hadPremium = user.roles.includes(Role.PREMIUM);
    const gainPremium = newRoles.includes(Role.PREMIUM) && !hadPremium;
    const lostPremium = !newRoles.includes(Role.PREMIUM) && hadPremium;

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const updates: Partial<User> = { roles: newRoles };

      if (lostPremium) {
        updates.premiumExpiresAt = null;
        updates.downloadQuota = 0;
        // Revoke active download records
        await qr.manager
          .createQueryBuilder()
          .update(DownloadRecord)
          .set({ revokedAt: new Date() })
          .where('user_id = :userId AND revoked_at IS NULL', { userId: targetUserId })
          .execute();
      }

      await qr.manager.update(User, targetUserId, updates);
      await qr.commitTransaction();
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }

    if (gainPremium) {
      await this.notificationsService.create(targetUserId, NotificationType.PREMIUM_ACTIVATED).catch(() => undefined);
    }
    if (lostPremium) {
      await this.notificationsService.create(targetUserId, NotificationType.PREMIUM_REVOKED).catch(() => undefined);
    }

    return this.users.findOne({ where: { id: targetUserId } }).then((u) => this.toUserSummaryDto(u!));
  }

  async getUserSessions(targetUserId: string) {
    const user = await this.users.findOne({ where: { id: targetUserId }, select: ['id'] });
    if (!user) throw new NotFoundException('User not found');

    const items = await this.sessions.find({
      where: { userId: targetUserId },
      select: ['id', 'deviceName', 'deviceType', 'ipAddress', 'lastSeenAt', 'createdAt'],
      order: { lastSeenAt: 'DESC' },
    });

    return items.map((s) => ({
      id: s.id,
      deviceName: s.deviceName,
      deviceType: s.deviceType,
      ip: s.ipAddress,
      lastSeenAt: s.lastSeenAt,
      createdAt: s.createdAt,
    }));
  }

  async deleteUserSession(targetUserId: string, sessionId: string) {
    const session = await this.sessions.findOne({
      where: { id: sessionId, userId: targetUserId },
    });
    if (!session) throw new NotFoundException('Session not found');

    await this.sessions.softDelete(sessionId);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Phase 9 — Audit log (BL-40)
  // ════════════════════════════════════════════════════════════════════════════

  getAuditLogs(opts: {
    page?: number;
    size?: number;
    action?: string;
    adminId?: string;
    targetType?: string;
    from?: string;
    to?: string;
  }) {
    return this.auditService.findAllPaginated(opts);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Phase 9 — Payments (BL-74, BL-75)
  // ════════════════════════════════════════════════════════════════════════════

  async listPayments(query: AdminPaymentQueryDto) {
    const page = query.page ?? 1;
    const size = query.size ?? 20;

    const qb = this.paymentRecords
      .createQueryBuilder('pr')
      .leftJoin('pr.user', 'u')
      .addSelect(['u.id', 'u.email'])
      .orderBy('pr.createdAt', 'DESC')
      .skip((page - 1) * size)
      .take(size);

    if (query.userId) qb.andWhere('pr.userId    = :userId', { userId: query.userId });
    if (query.provider) qb.andWhere('pr.provider  = :provider', { provider: query.provider });
    if (query.status) qb.andWhere('pr.status    = :status', { status: query.status });
    if (query.from) qb.andWhere('pr.createdAt >= :from', { from: new Date(query.from) });
    if (query.to) qb.andWhere('pr.createdAt <= :to', { to: new Date(query.to) });

    const [items, totalItems] = await qb.getManyAndCount();

    return {
      items: items.map((pr) => ({
        id: pr.id,
        userId: pr.userId,
        userEmail: (pr.user as any)?.email ?? null,
        provider: pr.provider,
        amountVnd: pr.amountVnd,
        premiumType: pr.premiumType,
        status: pr.status,
        transactionId: pr.transactionId,
        expiresAt: pr.expiresAt,
        createdAt: pr.createdAt,
      })),
      totalItems,
      page,
      size,
      totalPages: Math.ceil(totalItems / size),
    };
  }

  async listManualGrants(query: AdminPaymentQueryDto) {
    return this.listPayments({ ...query, provider: 'ADMIN' as any });
  }

  async adminGrantPremium(adminId: string, dto: AdminGrantPremiumDto): Promise<void> {
    await this.paymentsService.adminGrantPremiumByDays(dto.userId, dto.durationDays);
    await this.auditService.log(adminId, 'PREMIUM_GRANTED', 'USER', dto.userId, dto.notes);
  }

  async adminRevokePremiumAdmin(adminId: string, dto: AdminRevokePremiumDto): Promise<void> {
    await this.paymentsService.adminRevokePremium(dto.userId);
    await this.auditService.log(adminId, 'PREMIUM_REVOKED', 'USER', dto.userId, dto.notes);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Phase 9 — Reports (BL-38) — orchestrated via ReportsService
  // ════════════════════════════════════════════════════════════════════════════

  listReports(query: ReportAdminQueryDto) {
    return this.reportsService.findAllAdmin(query);
  }

  dismissReport(adminId: string, reportId: string, dto: ResolveReportDto) {
    return this.reportsService.dismiss(adminId, reportId, dto);
  }

  takedownReport(adminId: string, reportId: string, dto: ResolveReportDto) {
    return this.reportsService.takedown(adminId, reportId, dto);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Phase 9 — Revenue summary (BL-74)
  // ════════════════════════════════════════════════════════════════════════════

  async getRevenueSummary() {
    const now = new Date();

    // Build last-6-months scaffold in app (ensures 0-filled months are included)
    const monthScaffold = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return {
        month: d.toLocaleString('en-US', { month: 'short' }),
        yearMonth: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        total: 0,
      };
    });

    const [totalsRows, monthlyRows, providerRows] = await Promise.all([
      this.dataSource.query<Array<{
        today: string; this_month: string; this_year: string; all_time: string;
      }>>(`
        SELECT
          COALESCE(SUM(CASE WHEN created_at::date = CURRENT_DATE THEN amount_vnd ELSE 0 END), 0)::bigint AS today,
          COALESCE(SUM(CASE WHEN
            EXTRACT(YEAR  FROM created_at) = EXTRACT(YEAR  FROM NOW()) AND
            EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM NOW())
          THEN amount_vnd ELSE 0 END), 0)::bigint AS this_month,
          COALESCE(SUM(CASE WHEN EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW())
          THEN amount_vnd ELSE 0 END), 0)::bigint AS this_year,
          COALESCE(SUM(amount_vnd), 0)::bigint AS all_time
        FROM payment_records
        WHERE status = $1 AND amount_vnd IS NOT NULL
      `, [PaymentStatus.SUCCESS]),

      this.dataSource.query<Array<{ year_month: string; total: string }>>(`
        SELECT
          TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS year_month,
          COALESCE(SUM(amount_vnd), 0)::bigint AS total
        FROM payment_records
        WHERE status = $1
          AND amount_vnd IS NOT NULL
          AND created_at >= DATE_TRUNC('month', NOW() - INTERVAL '5 months')
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY 1
      `, [PaymentStatus.SUCCESS]),

      this.dataSource.query<Array<{ provider: string; total: string; cnt: string }>>(`
        SELECT
          provider,
          COALESCE(SUM(amount_vnd), 0)::bigint AS total,
          COUNT(*)::int                          AS cnt
        FROM payment_records
        WHERE status = $1 AND amount_vnd IS NOT NULL
        GROUP BY provider
      `, [PaymentStatus.SUCCESS]),
    ]);

    const t = totalsRows[0] ?? { today: '0', this_month: '0', this_year: '0', all_time: '0' };

    const monthMap = new Map(monthlyRows.map((r) => [r.year_month, Number(r.total)]));
    monthScaffold.forEach((m) => { m.total = monthMap.get(m.yearMonth) ?? 0; });

    return {
      today: Number(t.today),
      thisMonth: Number(t.this_month),
      thisYear: Number(t.this_year),
      allTime: Number(t.all_time),
      last6Months: monthScaffold.map(({ month, total }) => ({ month, total })),
      byProvider: providerRows.map((p) => ({
        provider: p.provider,
        total: Number(p.total),
        count: Number(p.cnt),
      })),
    };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Official Artist Management
  // ════════════════════════════════════════════════════════════════════════════

  async createOfficialArtist(adminId: string, dto: CreateOfficialArtistDto, avatar?: Express.Multer.File) {
    let avatarKey: string | null = dto.avatarUrl ?? null;

    if (avatar) {
      const allowed = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowed.includes(avatar.mimetype))
        throw new UnprocessableEntityException('Avatar must be JPEG, PNG or WebP');
      if (avatar.size > 5 * 1024 * 1024)
        throw new UnprocessableEntityException('Avatar must be under 5 MB');

      const ext = avatar.mimetype === 'image/jpeg' ? 'jpg' : avatar.mimetype.split('/')[1];
      const key = `avatars/artists/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      avatarKey = await this.storage.upload(this.storage.getBuckets().images, key, avatar.buffer, avatar.mimetype);
    }

    const artist = this.artistProfiles.create({
      userId: null,
      isOfficial: true,
      stageName: dto.stageName,
      bio: dto.bio ?? null,
      socialLinks: dto.socialLinks ?? [],
      suggestedGenres: dto.suggestedGenres ?? [],
      coverImageUrl: null,
      avatarUrl: avatarKey,
    });
    const saved = await this.artistProfiles.save(artist);
    await this.auditService.log(adminId, 'OFFICIAL_ARTIST_CREATED', 'ARTIST', saved.id, dto.stageName);
    return this.toArtistDto(saved);
  }

  async listOfficialArtists(page = 1, size = 20, search?: string) {
    const qb = this.artistProfiles
      .createQueryBuilder('ap')
      .where('ap.isOfficial = true')
      .orderBy('ap.createdAt', 'DESC')
      .skip((page - 1) * size)
      .take(size);

    if (search) qb.andWhere('ap.stageName ILIKE :s', { s: `%${search}%` });

    const [items, totalItems] = await qb.getManyAndCount();
    return {
      items: items.map((a) => this.toArtistDto(a)),
      totalItems,
      page,
      size,
      totalPages: Math.ceil(totalItems / size),
    };
  }

  async getOfficialArtistDetail(artistId: string) {
    const artist = await this.artistProfiles.findOne({ where: { id: artistId, isOfficial: true } });
    if (!artist) throw new NotFoundException('Official artist not found');

    const songCount = await this.songs.count({ where: { artistProfileId: artistId } });
    return { ...this.toArtistDto(artist), songCount };
  }

  async updateOfficialArtist(adminId: string, artistId: string, dto: UpdateOfficialArtistDto, avatar?: Express.Multer.File) {
    const artist = await this.artistProfiles.findOne({ where: { id: artistId, isOfficial: true } });
    if (!artist) throw new NotFoundException('Official artist not found');

    if (dto.stageName !== undefined) artist.stageName = dto.stageName;
    if (dto.bio !== undefined) artist.bio = dto.bio ?? null;
    if (dto.socialLinks !== undefined) artist.socialLinks = dto.socialLinks ?? [];
    if (dto.suggestedGenres !== undefined) artist.suggestedGenres = dto.suggestedGenres ?? [];

    if (avatar) {
      const allowed = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowed.includes(avatar.mimetype))
        throw new UnprocessableEntityException('Avatar must be JPEG, PNG or WebP');
      if (avatar.size > 5 * 1024 * 1024)
        throw new UnprocessableEntityException('Avatar must be under 5 MB');

      const ext = avatar.mimetype === 'image/jpeg' ? 'jpg' : avatar.mimetype.split('/')[1];
      const key = `avatars/artists/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      artist.avatarUrl = await this.storage.upload(this.storage.getBuckets().images, key, avatar.buffer, avatar.mimetype);
    } else if (dto.avatarUrl !== undefined) {
      artist.avatarUrl = dto.avatarUrl;
    }

    const saved = await this.artistProfiles.save(artist);
    await this.auditService.log(adminId, 'OFFICIAL_ARTIST_UPDATED', 'ARTIST', artistId);
    return this.toArtistDto(saved);
  }

  async deleteOfficialArtist(adminId: string, artistId: string) {
    const artist = await this.artistProfiles.findOne({ where: { id: artistId, isOfficial: true } });
    if (!artist) throw new NotFoundException('Official artist not found');
    await this.artistProfiles.remove(artist);
    await this.auditService.log(adminId, 'OFFICIAL_ARTIST_DELETED', 'ARTIST', artistId, artist.stageName);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Song detail + flexible status update
  // ════════════════════════════════════════════════════════════════════════════

  async getAdminSongDetail(songId: string) {
    const song = await this.findSongOrThrow(songId);

    // Artist lookup: prefer explicit artistProfileId, fall back to uploader's profile
    let artistName: string | null = null;
    let artistProfile: ArtistProfile | null = null;
    if (song.artistProfileId) {
      artistProfile = await this.artistProfiles.findOne({ where: { id: song.artistProfileId } });
    } else {
      artistProfile = await this.artistProfiles.findOne({ where: { userId: song.userId } });
    }
    if (artistProfile) artistName = artistProfile.stageName;

    const uploader = await this.users.findOne({ where: { id: song.userId }, select: ['id', 'email', 'name'] });

    // Presigned audio URL (short-lived, admin preview only)
    const audioUrl = await this.storage.presignedGetObject(
      this.storage.getBuckets().audio,
      song.fileUrl,
      3600,
    ).catch(() => null);

    const coverArtUrl = song.coverArtUrl
      ? this.storage.getPublicUrl(this.storage.getBuckets().images, song.coverArtUrl)
      : null;

    // Recent status-change audit events for this song
    const auditRows = await this.dataSource.query<Array<{
      id: string; action: string; admin_email: string | null; notes: string | null; created_at: string;
    }>>(
      `SELECT al.id, al.action, u.email AS admin_email, al.notes, al.created_at
       FROM audit_logs al
       LEFT JOIN users u ON u.id::text = al.admin_id::text
       WHERE al.target_id::text = $1
       ORDER BY al.created_at DESC
       LIMIT 15`,
      [songId],
    );

    return {
      id: song.id,
      title: song.title,
      status: song.status,
      coverArtUrl,
      audioUrl,
      artistName,
      artistProfileId: song.artistProfileId,
      uploaderEmail: uploader?.email ?? null,
      uploaderName: uploader?.name ?? null,
      bpm: song.bpm,
      duration: song.duration,
      camelotKey: song.camelotKey,
      genreIds: song.genreIds ?? [],
      dropAt: song.dropAt,
      totalPlays: song.listenCount,
      createdAt: song.createdAt,
      rejectionReason: song.rejectionReason,
      reuploadReason: song.reuploadReason,
      statusHistory: auditRows.map((r) => ({
        id: r.id,
        action: r.action,
        adminEmail: r.admin_email,
        notes: r.notes,
        createdAt: r.created_at,
      })),
    };
  }

  async updateSongStatus(adminId: string, songId: string, dto: UpdateSongStatusDto) {
    const song = await this.findSongOrThrow(songId);
    const allowed = STATUS_TRANSITIONS[song.status];
    if (!allowed?.has(dto.status)) {
      throw new BadRequestException(
        `Cannot transition from "${song.status}" to "${dto.status}"`,
      );
    }

    const prev = song.status;
    song.status = dto.status;

    if (dto.status === SongStatus.REJECTED && dto.reason) {
      song.rejectionReason = dto.reason;
    }
    if (dto.status === SongStatus.REUPLOAD_REQUIRED && dto.reason) {
      song.reuploadReason = dto.reason;
    }
    if (dto.status === SongStatus.SCHEDULED) {
      if (!song.dropAt || song.dropAt <= new Date()) {
        throw new BadRequestException('Cannot schedule: song has no future dropAt date');
      }
    }

    await this.songs.save(song);

    if (dto.status === SongStatus.SCHEDULED) {
      await this.dropsService.enqueueDropJobs(song);
    }

    await this.auditService.log(
      adminId, 'SONG_STATUS_UPDATED', 'SONG', songId,
      `${prev} → ${dto.status}${dto.reason ? ': ' + dto.reason : ''}`,
    );

    // Notifications (only when uploader is a real user)
    const artist = song.userId ? await this.users.findOne({ where: { id: song.userId } }) : null;
    if (artist) {
      const payload = { songId, songTitle: song.title };
      if (dto.status === SongStatus.LIVE && prev === SongStatus.TAKEN_DOWN) {
        await Promise.allSettled([
          this.notificationsService.create(artist.id, NotificationType.SONG_RESTORED, payload),
          this.emailQueue.add('send', {
            to: artist.email, subject: `Your song "${song.title}" has been restored`,
            html: this.mailService.songRestoredEmail(song.title),
          }).catch(() => undefined),
        ]);
      } else if (dto.status === SongStatus.LIVE) {
        await Promise.allSettled([
          this.notificationsService.create(artist.id, NotificationType.SONG_APPROVED, payload),
          this.emailQueue.add('send', {
            to: artist.email, subject: `Your song "${song.title}" has been approved`,
            html: this.mailService.songApprovedEmail(song.title),
          }).catch(() => undefined),
        ]);
      } else if (dto.status === SongStatus.REJECTED) {
        const reason = dto.reason ?? 'Administrative decision';
        await Promise.allSettled([
          this.notificationsService.create(artist.id, NotificationType.SONG_REJECTED, { ...payload, reason }),
          this.emailQueue.add('send', {
            to: artist.email, subject: `Song review update: "${song.title}"`,
            html: this.mailService.songRejectedEmail(song.title, reason),
          }).catch(() => undefined),
        ]);
      } else if (dto.status === SongStatus.REUPLOAD_REQUIRED) {
        const notes = dto.reason ?? 'Please reupload';
        await Promise.allSettled([
          this.notificationsService.create(artist.id, NotificationType.SONG_REUPLOAD_REQUIRED, { ...payload, notes }),
          this.emailQueue.add('send', {
            to: artist.email, subject: `Action required for "${song.title}"`,
            html: this.mailService.songReuploadRequiredEmail(song.title, notes),
          }).catch(() => undefined),
        ]);
      }
    }

    return this.songsService.buildSongResponse(song);
  }

  async adminUploadSong(
    adminId: string,
    dto: AdminUploadSongDto,
    audioFile: Express.Multer.File,
    coverArtFile?: Express.Multer.File,
  ) {
    // Validate artistProfileId is an official artist if provided
    if (dto.artistProfileId) {
      const artist = await this.artistProfiles.findOne({ where: { id: dto.artistProfileId, isOfficial: true } });
      if (!artist) throw new BadRequestException('Artist profile not found or is not an official artist');
    }
    const result = await this.songsService.adminUploadSong(adminId, dto, audioFile, coverArtFile);
    await this.auditService.log(adminId, 'SONG_ADMIN_UPLOADED', 'SONG', result.id, dto.title);
    return result;
  }

  // ── Update song genres (admin inline picker) ──────────────────────────────

  async updateSongGenres(songId: string, genreIds: string[]): Promise<{ id: string; genreIds: string[] }> {
    const song = await this.findSongOrThrow(songId);

    if (!genreIds || genreIds.length === 0) {
      throw new BadRequestException('At least one genre ID is required');
    }

    // Validate all provided IDs exist in the genres table via GenresService
    const allGenres = await this.genresService.findAll();
    const validIds = new Set(allGenres.map((g) => g.id));
    const invalid = genreIds.filter((id) => !validIds.has(id));
    if (invalid.length > 0) {
      throw new BadRequestException(`Unknown genre IDs: ${invalid.join(', ')}`);
    }

    song.genreIds = genreIds;
    const saved = await this.songs.save(song);
    return { id: saved.id, genreIds: saved.genreIds };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Private helpers
  // ════════════════════════════════════════════════════════════════════════════

  private async findSongOrThrow(songId: string): Promise<Song> {
    const song = await this.songs.findOne({ where: { id: songId } });
    if (!song) throw new NotFoundException('Song not found');
    return song;
  }

  private toArtistDto(a: ArtistProfile) {
    return {
      id: a.id,
      stageName: a.stageName,
      bio: a.bio,
      coverImageUrl: a.coverImageUrl
        ? this.storage.getPublicUrl(this.storage.getBuckets().images, a.coverImageUrl)
        : null,
      avatarUrl: a.avatarUrl
        ? this.storage.getPublicUrl(this.storage.getBuckets().images, a.avatarUrl)
        : null,
      socialLinks: a.socialLinks ?? [],
      suggestedGenres: a.suggestedGenres ?? [],
      followerCount: a.followerCount,
      listenerCount: a.listenerCount,
      isOfficial: a.isOfficial,
      createdAt: a.createdAt,
    };
  }

  private toUserSummaryDto(u: User) {
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      roles: u.roles,
      isPremium: u.isPremium,
      premiumExpiresAt: u.premiumExpiresAt,
      createdAt: u.createdAt,
    };
  }
}
