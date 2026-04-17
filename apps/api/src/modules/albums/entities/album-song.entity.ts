import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
} from 'typeorm';
import { Album } from './album.entity';
import { Song } from '../../songs/entities/song.entity';

// Join table — each song can belong to exactly one album at a time.
// position allows ordered track listing within an album.
@Entity('album_songs')
@Unique(['albumId', 'songId'])
export class AlbumSong {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'album_id' })
  albumId: string;

  @ManyToOne(() => Album, (album) => album.albumSongs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'album_id' })
  album: Album;

  @Index()
  @Column({ name: 'song_id' })
  songId: string;

  // When a song is deleted, its album-song link is also removed
  @ManyToOne(() => Song, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'song_id' })
  song: Song;

  // 0-based track order within the album
  @Column({ default: 0 })
  position: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
