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
import { ContentTargetType, ReportReason, ReportStatus } from '../../../common/enums';
import { User } from '../../auth/entities/user.entity';

@Entity('reports')
@Unique(['reporterId', 'targetType', 'targetId'])
export class Report {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'reporter_id' })
  reporterId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reporter_id' })
  reporter: User;

  @Index()
  @Column({ name: 'target_type', length: 20 })
  targetType: ContentTargetType;

  // Polymorphic — no FK; validated in service
  @Column({ name: 'target_id', type: 'uuid' })
  targetId: string;

  @Column({ length: 30 })
  reason: ReportReason;

  @Index()
  @Column({ length: 20, default: ReportStatus.PENDING })
  status: ReportStatus;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'resolved_by_id', nullable: true })
  resolvedById: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'resolved_by_id' })
  resolvedBy: User | null;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
