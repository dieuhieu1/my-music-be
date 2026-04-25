import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Song } from '../../songs/entities/song.entity';

// Append-only playback history — used by the recommendation engine (Phase 10).
@Entity('play_history')
@Index(['userId', 'songId', 'skipped'])  // required for Phase 10 skip penalty lookup (BL-35B)
export class PlayHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id' })
  userId: string;

  @Index()
  @Column({ name: 'song_id' })
  songId: string;

  @ManyToOne(() => Song, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'song_id' })
  song: Song;

  @Column({ name: 'played_at', type: 'timestamptz' })
  playedAt: Date;

  // true when the user skipped before the 30-second mark.
  // Sent by the FE via POST /playback/:id/play { skipped: true }.
  // Default false preserves existing records.
  @Column({ default: false })
  skipped: boolean;
}
