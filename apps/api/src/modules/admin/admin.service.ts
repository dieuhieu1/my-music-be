import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import { Song } from '../songs/entities/song.entity';
import { User } from '../auth/entities/user.entity';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../mail/mail.service';
import { GenresService } from '../genres/genres.service';
import { SongsService } from '../songs/songs.service';
import { NotificationType, SongStatus } from '../../common/enums';
import { QUEUE_NAMES } from '../queue/queue.constants';
import { DropsService } from '../drops/drops.service';
import { RejectSongDto } from './dto/reject-song.dto';
import { ReuploadRequiredDto } from './dto/reupload-required.dto';
import { RejectGenreSuggestionDto } from './dto/reject-genre-suggestion.dto';

const ALLOWED_APPROVE_STATUSES = new Set([SongStatus.PENDING]);
const ALLOWED_REJECT_STATUSES = new Set([SongStatus.PENDING]);
const ALLOWED_REUPLOAD_STATUSES = new Set([SongStatus.PENDING]);
const ALLOWED_RESTORE_STATUSES = new Set([SongStatus.TAKEN_DOWN]);

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Song) private readonly songs: Repository<Song>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly mailService: MailService,
    private readonly genresService: GenresService,
    private readonly songsService: SongsService,
    private readonly dropsService: DropsService,
    @InjectQueue(QUEUE_NAMES.EMAIL) private readonly emailQueue: Queue,
  ) {}

  // ── GET /admin/songs (approval queue — BL-37) ────────────────────────────

  async getSongApprovalQueue() {
    const songs = await this.songs.find({
      where: { status: SongStatus.PENDING },
      order: { createdAt: 'ASC' },
    });
    return Promise.all(songs.map((s) => this.songsService.buildSongResponse(s)));
  }

  // ── PATCH /admin/songs/:id/approve (BL-37) ───────────────────────────────

  async approveSong(adminId: string, songId: string) {
    const song = await this.findSongOrThrow(songId);

    if (!ALLOWED_APPROVE_STATUSES.has(song.status)) {
      throw new BadRequestException(`Cannot approve a song with status "${song.status}"`);
    }

    song.status = song.dropAt && song.dropAt > new Date() ? SongStatus.SCHEDULED : SongStatus.LIVE;
    await this.songs.save(song);

    // BL-61: enqueue 24h + 1h BullMQ delayed notification jobs when song is SCHEDULED
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

  // ── PATCH /admin/songs/:id/reject (BL-37) ───────────────────────────────

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

  // ── PATCH /admin/songs/:id/reupload-required (BL-84) ────────────────────

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

  // ── PATCH /admin/songs/:id/restore (BL-83) ──────────────────────────────

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

  // ── GET /admin/genres/suggestions (BL-69) ────────────────────────────────

  findAllGenreSuggestions() {
    return this.genresService.findAllSuggestions();
  }

  // ── PATCH /admin/genres/suggestions/:id/approve (BL-70) ─────────────────

  async approveGenreSuggestion(adminId: string, suggestionId: string) {
    const result = await this.genresService.approveSuggestion(adminId, suggestionId);
    await this.auditService.log(adminId, 'GENRE_SUGGESTION_APPROVED', 'GENRE_SUGGESTION', suggestionId);
    return result;
  }

  // ── PATCH /admin/genres/suggestions/:id/reject (BL-71) ───────────────────

  async rejectGenreSuggestion(
    adminId: string,
    suggestionId: string,
    dto: RejectGenreSuggestionDto,
  ) {
    const result = await this.genresService.rejectSuggestion(adminId, suggestionId, dto.notes);
    await this.auditService.log(
      adminId,
      'GENRE_SUGGESTION_REJECTED',
      'GENRE_SUGGESTION',
      suggestionId,
      dto.notes,
    );
    return result;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async findSongOrThrow(songId: string): Promise<Song> {
    const song = await this.songs.findOne({ where: { id: songId } });
    if (!song) throw new NotFoundException('Song not found');
    return song;
  }
}
