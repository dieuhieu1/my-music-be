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
import { Song } from '../../songs/entities/song.entity';

@Entity('playlist_songs')
@Unique(['playlistId', 'songId'])
export class PlaylistSong {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'playlist_id' })
  playlistId: string;

  @Index()
  @Column({ name: 'song_id' })
  songId: string;

  @ManyToOne(() => Playlist, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'playlist_id' })
  playlist: Playlist;

  @ManyToOne(() => Song, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'song_id' })
  song: Song;

  // 0-based; ORDER BY position ASC for display
  @Column({ default: 0 })
  position: number;

  @CreateDateColumn({ name: 'added_at', type: 'timestamptz' })
  addedAt: Date;
}
