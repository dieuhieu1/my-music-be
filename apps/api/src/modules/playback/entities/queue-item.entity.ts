import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Song } from '../../songs/entities/song.entity';

// Per-user playback queue — hard-deleted on logout (BL-03) and on song deletion (CASCADE).
@Entity('queue_items')
export class QueueItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id' })
  userId: string;

  @Index()
  @Column({ name: 'song_id' })
  songId: string;

  // 0-based; gaps are allowed — always ORDER BY position ASC
  @Column({ default: 0 })
  position: number;

  @ManyToOne(() => Song, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'song_id' })
  song: Song;

  @CreateDateColumn({ name: 'added_at', type: 'timestamptz' })
  addedAt: Date;
}
