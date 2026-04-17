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
import { SongStatus } from '../../../common/enums';
import { User } from '../../auth/entities/user.entity';

@Entity('songs')
export class Song {
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

  // Seconds — populated by the DSP audio-extraction worker after upload
  @Column({ type: 'float', nullable: true })
  duration: number | null;

  // MinIO object path for the stripped (metadata-removed) audio file
  @Column({ name: 'file_url', length: 500 })
  fileUrl: string;

  // MinIO object path for the AES-256-CBC encrypted copy (BL-44, used for PREMIUM downloads)
  @Column({ name: 'encrypted_file_url', length: 500 })
  encryptedFileUrl: string;

  @Column({ name: 'cover_art_url', length: 500, nullable: true })
  coverArtUrl: string | null;

  // UUIDs of Genre records — stored as comma-separated via simple-array
  @Column({ name: 'genre_ids', type: 'simple-array', nullable: true })
  genreIds: string[];

  // BPM set by DSP; artist can override after extraction (BL-37A)
  @Column({ type: 'float', nullable: true })
  bpm: number | null;

  // Camelot Wheel notation e.g. "8B", "5A" — set by DSP; artist-editable (BL-37A)
  @Column({ name: 'camelot_key', length: 10, nullable: true })
  camelotKey: string | null;

  // Composite energy score — NEVER exposed via API response (BL-37A)
  @Column({ type: 'float', nullable: true })
  energy: number | null;

  @Column({ type: 'enum', enum: SongStatus, default: SongStatus.PENDING })
  status: SongStatus;

  // Scheduled drop timestamp (Phase 8 — BL-59)
  @Column({ name: 'drop_at', type: 'timestamptz', nullable: true })
  dropAt: Date | null;

  // Admin-supplied reason when requesting a reupload (Phase 4B — BL-84)
  @Column({ name: 'reupload_reason', type: 'text', nullable: true })
  reuploadReason: string | null;

  @Column({ name: 'listen_count', default: 0 })
  listenCount: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
