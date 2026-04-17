import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Song } from './song.entity';

// Stores the AES-256-CBC key and IV used to encrypt each song file (BL-44).
// One-to-one with Song; cascade-deleted when song is deleted.
// In production, aesKey should be envelope-encrypted with a KMS master key.
@Entity('song_encryption_keys')
export class SongEncryptionKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ name: 'song_id' })
  songId: string;

  @OneToOne(() => Song, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'song_id' })
  song: Song;

  // Base64-encoded 32-byte AES-256 key
  @Column({ name: 'aes_key', length: 100 })
  aesKey: string;

  // Base64-encoded 16-byte CBC initialization vector
  @Column({ length: 50 })
  iv: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
