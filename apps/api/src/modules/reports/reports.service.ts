import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import { Report } from './entities/report.entity';
import { Song } from '../songs/entities/song.entity';
import { Playlist } from '../playlists/entities/playlist.entity';
import { User } from '../auth/entities/user.entity';
import { ArtistProfile } from '../auth/entities/artist-profile.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../mail/mail.service';
import {
  ContentTargetType,
  NotificationType,
  ReportStatus,
  Role,
  SongStatus,
} from '../../common/enums';
import { QUEUE_NAMES } from '../queue/queue.constants';
import { CreateReportDto } from './dto/create-report.dto';
import { ResolveReportDto } from './dto/resolve-report.dto';
import { ReportAdminQueryDto } from './dto/report-admin-query.dto';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Report) private readonly reports: Repository<Report>,
    @InjectRepository(Song) private readonly songs: Repository<Song>,
    @InjectRepository(Playlist) private readonly playlists: Repository<Playlist>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(ArtistProfile) private readonly artistProfiles: Repository<ArtistProfile>,
    private readonly dataSource: DataSource,
    private readonly notificationsService: NotificationsService,
    private readonly mailService: MailService,
    @InjectQueue(QUEUE_NAMES.EMAIL) private readonly emailQueue: Queue,
  ) {}

  // ── POST /reports (BL-38) ────────────────────────────────────────────────────

  async create(reporterId: string, dto: CreateReportDto): Promise<Report> {
    await this.validateTargetExists(dto.targetType, dto.targetId);

    // Cannot report your own content
    await this.assertNotOwnContent(reporterId, dto.targetType, dto.targetId);

    // Upsert on (reporterId, targetType, targetId)
    const existing = await this.reports.findOne({
      where: { reporterId, targetType: dto.targetType, targetId: dto.targetId },
    });

    if (existing) {
      await this.reports.update(existing.id, { reason: dto.reason, status: ReportStatus.PENDING });
      return this.reports.findOne({ where: { id: existing.id } }) as Promise<Report>;
    }

    const report = this.reports.create({
      reporterId,
      targetType: dto.targetType,
      targetId: dto.targetId,
      reason: dto.reason,
      status: ReportStatus.PENDING,
    });
    return this.reports.save(report);
  }

  // ── GET /admin/reports (BL-38) ───────────────────────────────────────────────

  async findAllAdmin(query: ReportAdminQueryDto) {
    const page = query.page ?? 1;
    const size = query.size ?? 20;

    const qb = this.reports
      .createQueryBuilder('r')
      .leftJoin('r.reporter', 'u')
      .addSelect(['u.id', 'u.email', 'u.name'])
      .orderBy('r.createdAt', 'DESC')
      .skip((page - 1) * size)
      .take(size);

    if (query.status)     qb.andWhere('r.status = :status',         { status: query.status });
    if (query.targetType) qb.andWhere('r.targetType = :targetType', { targetType: query.targetType });
    if (query.reason)     qb.andWhere('r.reason = :reason',         { reason: query.reason });

    const [items, totalItems] = await qb.getManyAndCount();

    return {
      items: items.map((r) => this.toAdminDto(r)),
      totalItems,
      page,
      size,
      totalPages: Math.ceil(totalItems / size),
    };
  }

  // ── PATCH /admin/reports/:id/dismiss ─────────────────────────────────────────

  async dismiss(adminId: string, reportId: string, dto: ResolveReportDto): Promise<Report> {
    const report = await this.findOrThrow(reportId);
    this.assertResolvable(report);

    await this.reports.update(reportId, {
      status: ReportStatus.DISMISSED,
      notes: dto.notes ?? null,
      resolvedById: adminId,
      resolvedAt: new Date(),
    });

    return this.reports.findOne({ where: { id: reportId } }) as Promise<Report>;
  }

  // ── PATCH /admin/reports/:id/takedown ────────────────────────────────────────

  async takedown(adminId: string, reportId: string, dto: ResolveReportDto): Promise<Report> {
    const report = await this.findOrThrow(reportId);
    this.assertResolvable(report);

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      await qr.manager.update(Report, reportId, {
        status: ReportStatus.RESOLVED,
        notes: dto.notes ?? null,
        resolvedById: adminId,
        resolvedAt: new Date(),
      });

      await this.applyCascade(qr.manager, report, adminId);

      await qr.commitTransaction();
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }

    // Fire-and-forget notifications after commit
    await this.sendTakedownNotification(report).catch(() => undefined);

    return this.reports.findOne({ where: { id: reportId } }) as Promise<Report>;
  }

  // ── Private ───────────────────────────────────────────────────────────────────

  private async applyCascade(
    manager: DataSource['manager'],
    report: Report,
    adminId: string,
  ): Promise<void> {
    switch (report.targetType) {
      case ContentTargetType.SONG: {
        const song = await manager.findOne(Song, { where: { id: report.targetId } });
        if (song) {
          await manager.update(Song, song.id, { status: SongStatus.TAKEN_DOWN });
        }
        break;
      }
      case ContentTargetType.PLAYLIST: {
        await manager.delete(Playlist, { id: report.targetId });
        break;
      }
      case ContentTargetType.ARTIST: {
        // Remove ARTIST role from the user whose artist profile = targetId
        const profile = await manager.findOne(ArtistProfile, { where: { id: report.targetId } });
        if (profile) {
          const user = await manager.findOne(User, { where: { id: profile.userId } });
          if (user) {
            const newRoles = user.roles.filter((r) => r !== Role.ARTIST);
            await manager.update(User, user.id, { roles: newRoles });
          }
        }
        break;
      }
      default:
        break;
    }
  }

  private async sendTakedownNotification(report: Report): Promise<void> {
    if (report.targetType !== ContentTargetType.SONG) return;

    const song = await this.songs.findOne({ where: { id: report.targetId } });
    if (!song) return;

    const owner = await this.users.findOne({ where: { id: song.userId } });
    if (!owner) return;

    await Promise.allSettled([
      this.notificationsService.create(owner.id, NotificationType.SONG_TAKEN_DOWN, {
        songId: song.id,
        songTitle: song.title,
      }),
      this.emailQueue.add('send-email', {
        to: owner.email,
        subject: `Your song "${song.title}" has been taken down`,
        html: this.mailService.songTakenDownEmail(song.title),
      }),
    ]);
  }

  private async validateTargetExists(
    targetType: ContentTargetType,
    targetId: string,
  ): Promise<void> {
    let exists = false;

    switch (targetType) {
      case ContentTargetType.SONG:
        exists = !!(await this.songs.findOne({
          where: { id: targetId, status: SongStatus.LIVE },
          select: ['id'],
        }));
        break;
      case ContentTargetType.PLAYLIST:
        exists = !!(await this.playlists.findOne({
          where: { id: targetId, isPublic: true },
          select: ['id'],
        }));
        break;
      case ContentTargetType.ARTIST:
        exists = !!(await this.artistProfiles.findOne({
          where: { id: targetId },
          select: ['id'],
        }));
        break;
      default:
        throw new UnprocessableEntityException(`Unsupported target type: ${targetType}`);
    }

    if (!exists) throw new NotFoundException(`${targetType} not found`);
  }

  private async assertNotOwnContent(
    reporterId: string,
    targetType: ContentTargetType,
    targetId: string,
  ): Promise<void> {
    let ownerId: string | null = null;

    switch (targetType) {
      case ContentTargetType.SONG: {
        const song = await this.songs.findOne({ where: { id: targetId }, select: ['userId'] });
        ownerId = song?.userId ?? null;
        break;
      }
      case ContentTargetType.PLAYLIST: {
        const playlist = await this.playlists.findOne({ where: { id: targetId }, select: ['userId'] });
        ownerId = playlist?.userId ?? null;
        break;
      }
      case ContentTargetType.ARTIST: {
        const profile = await this.artistProfiles.findOne({ where: { id: targetId }, select: ['userId'] });
        ownerId = profile?.userId ?? null;
        break;
      }
    }

    if (ownerId && ownerId === reporterId) {
      throw new ForbiddenException('Cannot report your own content');
    }
  }

  private async findOrThrow(reportId: string): Promise<Report> {
    const report = await this.reports.findOne({ where: { id: reportId } });
    if (!report) throw new NotFoundException('Report not found');
    return report;
  }

  private assertResolvable(report: Report): void {
    if (report.status !== ReportStatus.PENDING) {
      throw new UnprocessableEntityException(
        `Report is already ${report.status} and cannot be re-resolved`,
      );
    }
  }

  private toAdminDto(r: Report) {
    return {
      id: r.id,
      reporterId: r.reporterId,
      reporterEmail: (r.reporter as any)?.email ?? null,
      reporterName: (r.reporter as any)?.name ?? null,
      targetType: r.targetType,
      targetId: r.targetId,
      reason: r.reason,
      status: r.status,
      notes: r.notes,
      resolvedById: r.resolvedById,
      resolvedAt: r.resolvedAt,
      createdAt: r.createdAt,
    };
  }
}
