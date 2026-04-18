import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Song } from '../../songs/entities/song.entity';

// Append-only playback history — used by the recommendation engine in Phase 10.
@Entity('play_history')
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
}
