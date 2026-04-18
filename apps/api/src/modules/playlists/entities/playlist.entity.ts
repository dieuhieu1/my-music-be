import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';

@Entity('playlists')
export class Playlist {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'cover_art_url', length: 500, nullable: true })
  coverArtUrl: string | null;

  @Column({ name: 'is_public', default: false })
  isPublic: boolean;

  // Special system playlist — created on first like (BL-34), never deleted manually
  @Column({ name: 'is_liked_songs', default: false })
  isLikedSongs: boolean;

  // Recomputed on song add/remove (BL-15)
  @Column({ name: 'total_tracks', default: 0 })
  totalTracks: number;

  // Total duration in hours — recomputed on song add/remove (BL-15)
  @Column({ name: 'total_hours', type: 'float', default: 0 })
  totalHours: number;

  // Incremented on every GET /playlists/:id and on save (BL-12, BL-13)
  @Column({ name: 'listener_count', default: 0 })
  listenerCount: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
