import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { Song } from '../../songs/entities/song.entity';

@Entity('download_records')
@Index('idx_download_records_user', ['userId', 'revokedAt'])
export class DownloadRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Index()
  @Column({ name: 'song_id' })
  songId: string;

  @ManyToOne(() => Song, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'song_id' })
  song: Song;

  // Signed JWT containing aesKey + iv for client-side AES-256-CBC decryption
  @Column({ name: 'license_jwt', type: 'text' })
  licenseJwt: string;

  @CreateDateColumn({ name: 'downloaded_at', type: 'timestamptz' })
  downloadedAt: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;
}
