import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';

import { QueueItem } from './entities/queue-item.entity';
import { PlayHistory } from './entities/play-history.entity';
import { Song } from '../songs/entities/song.entity';
import { SongsService } from '../songs/songs.service';
import { AddToQueueDto } from './dto/add-to-queue.dto';
import { ReorderQueueDto } from './dto/reorder-queue.dto';
import { RecordPlayDto } from './dto/record-play.dto';
import { SongStatus } from '../../common/enums';

@Injectable()
export class PlaybackService {
  constructor(
    @InjectRepository(QueueItem)  private readonly queueItems:  Repository<QueueItem>,
    @InjectRepository(PlayHistory) private readonly playHistory: Repository<PlayHistory>,
    @InjectRepository(Song)       private readonly songs:       Repository<Song>,
    private readonly songsService: SongsService,
    private readonly dataSource:   DataSource,
  ) {}

  // ── GET /queue (BL-31) ────────────────────────────────────────────────────

  async getQueue(userId: string) {
    const items = await this.queueItems.find({
      where: { userId },
      relations: ['song'],
      order: { position: 'ASC' },
    });

    return Promise.all(
      items.map(async (item) => ({
        id:       item.id,
        position: item.position,
        addedAt:  item.addedAt,
        song:     item.song ? await this.songsService.buildSongResponse(item.song) : null,
      })),
    );
  }

  // ── POST /queue (BL-31) ───────────────────────────────────────────────────

  async addToQueue(userId: string, dto: AddToQueueDto) {
    const song = await this.songs.findOne({ where: { id: dto.songId } });
    if (!song) throw new NotFoundException('Song not found');
    if (song.status !== SongStatus.LIVE) throw new BadRequestException('Only LIVE songs can be queued');

    // Position = max + 1 (append to end)
    const result = await this.queueItems
      .createQueryBuilder('qi')
      .select('MAX(qi.position)', 'max')
      .where('qi.userId = :userId', { userId })
      .getRawOne<{ max: number | null }>();

    const position = (result?.max ?? -1) + 1;

    const item = this.queueItems.create({ userId, songId: dto.songId, position });
    const saved = await this.queueItems.save(item);

    return {
      id:       saved.id,
      position: saved.position,
      addedAt:  saved.addedAt,
      song:     await this.songsService.buildSongResponse(song),
    };
  }

  // ── PATCH /queue/reorder (BL-31) ─────────────────────────────────────────

  async reorderQueue(userId: string, dto: ReorderQueueDto) {
    await this.dataSource.transaction(async (manager) => {
      for (const { id, position } of dto.items) {
        await manager.update(QueueItem, { id, userId }, { position });
      }
    });
    return this.getQueue(userId);
  }

  // ── PATCH /queue/smart-order (BL-37C) ─────────────────────────────────────
  // Re-orders the queue using Camelot Wheel harmonic compatibility (nearest-
  // neighbour greedy). Songs without a camelotKey fall back to BPM proximity.

  async smartOrder(userId: string) {
    const items = await this.queueItems.find({
      where: { userId },
      relations: ['song'],
      order: { position: 'ASC' },
    });

    if (items.length <= 1) return this.getQueue(userId);

    const seeds = items.map((item) => ({
      id:         item.id,
      camelotKey: item.song?.camelotKey ?? null,
      bpm:        item.song?.bpm        ?? null,
    }));

    const orderedIds = this.buildSmartOrder(seeds);

    await this.dataSource.transaction(async (manager) => {
      for (let i = 0; i < orderedIds.length; i++) {
        await manager.update(QueueItem, { id: orderedIds[i], userId }, { position: i });
      }
    });

    return this.getQueue(userId);
  }

  // ── DELETE /queue/:id (BL-31) ─────────────────────────────────────────────

  async removeFromQueue(userId: string, itemId: string): Promise<void> {
    const item = await this.queueItems.findOne({ where: { id: itemId, userId } });
    if (!item) throw new NotFoundException('Queue item not found');
    await this.queueItems.remove(item);
  }

  // ── DELETE /queue (BL-03: hard-delete on logout) ─────────────────────────

  async clearQueue(userId: string): Promise<void> {
    await this.queueItems.delete({ userId });
  }

  // ── POST /playback/history (BL-30) ───────────────────────────────────────

  async recordPlay(userId: string, dto: RecordPlayDto) {
    const song = await this.songs.findOne({ where: { id: dto.songId } });
    if (!song) throw new NotFoundException('Song not found');
    if (song.status !== SongStatus.LIVE) throw new BadRequestException('Cannot record play for non-LIVE song');

    const entry = this.playHistory.create({
      userId,
      songId: dto.songId,
      playedAt: dto.playedAt ? new Date(dto.playedAt) : new Date(),
    });
    await this.playHistory.save(entry);
    return { recorded: true };
  }

  // ── Camelot Wheel nearest-neighbour sort ─────────────────────────────────

  private buildSmartOrder(
    seeds: Array<{ id: string; camelotKey: string | null; bpm: number | null }>,
  ): string[] {
    const remaining = [...seeds];
    const ordered: string[] = [];

    let current = remaining.shift()!;
    ordered.push(current.id);

    while (remaining.length > 0) {
      let bestIdx  = 0;
      let bestScore = Infinity;

      for (let i = 0; i < remaining.length; i++) {
        const score = this.camelotScore(current.camelotKey, current.bpm, remaining[i].camelotKey, remaining[i].bpm);
        if (score < bestScore) {
          bestScore = score;
          bestIdx   = i;
        }
      }

      current = remaining.splice(bestIdx, 1)[0];
      ordered.push(current.id);
    }

    return ordered;
  }

  private camelotScore(
    key1: string | null, bpm1: number | null,
    key2: string | null, bpm2: number | null,
  ): number {
    const keyScore = this.camelotCompatibility(key1, key2);

    // Blend key and BPM (±3 BPM is considered identical)
    const bpmScore = (bpm1 && bpm2) ? Math.abs(bpm1 - bpm2) / 3 : 0;

    return keyScore * 10 + bpmScore;
  }

  private camelotCompatibility(key1: string | null, key2: string | null): number {
    if (!key1 || !key2) return 9;
    if (key1 === key2)  return 0;

    const m1 = key1.match(/^(\d+)([AB])$/i);
    const m2 = key2.match(/^(\d+)([AB])$/i);
    if (!m1 || !m2) return 9;

    const n1   = parseInt(m1[1]);
    const n2   = parseInt(m2[1]);
    const mode1 = m1[2].toUpperCase();
    const mode2 = m2[2].toUpperCase();

    const numDiff = Math.min(Math.abs(n1 - n2), 12 - Math.abs(n1 - n2));

    if (mode1 === mode2) return numDiff;        // same mode — semitone steps
    if (n1   === n2)     return 1;              // relative major/minor
    return numDiff + 2;                         // cross-mode — penalised
  }
}
