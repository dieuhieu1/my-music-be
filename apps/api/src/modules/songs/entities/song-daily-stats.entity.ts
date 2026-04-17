import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { Song } from './song.entity';

// Per-song daily play counts — upserted by GET /songs/:id in Phase 5 (BL-09).
// The composite unique constraint prevents duplicate rows per (songId, date).
@Entity('song_daily_stats')
@Unique(['songId', 'date'])
export class SongDailyStats {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'song_id' })
  songId: string;

  @ManyToOne(() => Song, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'song_id' })
  song: Song;

  // ISO date string — YYYY-MM-DD stored as text for portability
  @Column({ type: 'date' })
  date: string;

  @Column({ name: 'play_count', default: 0 })
  playCount: number;
}
