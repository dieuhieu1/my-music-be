import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { AlbumSong } from './album-song.entity';

@Entity('albums')
export class Album {
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

  // Maintained by BL-14 whenever songs are added / removed / duration changes
  @Column({ name: 'total_tracks', default: 0 })
  totalTracks: number;

  // Total duration in hours — BL-14
  @Column({ name: 'total_hours', type: 'float', default: 0 })
  totalHours: number;

  @Column({ name: 'released_at', type: 'timestamptz', nullable: true })
  releasedAt: Date | null;

  @OneToMany(() => AlbumSong, (as) => as.album, { cascade: true })
  albumSongs: AlbumSong[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
