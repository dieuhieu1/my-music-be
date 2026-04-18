import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { Playlist } from './playlist.entity';

@Entity('saved_playlists')
@Unique(['userId', 'playlistId'])
export class SavedPlaylist {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id' })
  userId: string;

  @Index()
  @Column({ name: 'playlist_id' })
  playlistId: string;

  @ManyToOne(() => Playlist, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'playlist_id' })
  playlist: Playlist;

  @CreateDateColumn({ name: 'saved_at', type: 'timestamptz' })
  savedAt: Date;
}
