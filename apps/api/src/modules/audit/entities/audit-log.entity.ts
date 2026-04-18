import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

// Immutable admin action log — never deleted (BL-40).
// Written after every admin mutation via AuditLogInterceptor.
@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'admin_id' })
  adminId: string;

  // e.g. SONG_APPROVED, SONG_REJECTED, SONG_REUPLOAD_REQUIRED, SONG_RESTORED,
  //      GENRE_SUGGESTION_APPROVED, GENRE_SUGGESTION_REJECTED, SONG_RESUBMITTED
  @Column({ length: 100 })
  action: string;

  // e.g. SONG, GENRE_SUGGESTION, USER
  @Column({ name: 'target_type', length: 50 })
  targetType: string;

  @Column({ name: 'target_id', nullable: true })
  targetId: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
