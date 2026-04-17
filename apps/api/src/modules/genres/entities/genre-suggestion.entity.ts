import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { GenreSuggestionStatus } from '../../../common/enums';
import { User } from '../../auth/entities/user.entity';

// Artist-submitted genre suggestions — approved / rejected by admin in Phase 4B (BL-68–71).
// Approved suggestions become Genre records and are retroactively applied (BL-49).
@Entity('genre_suggestions')
export class GenreSuggestion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ length: 100 })
  name: string;

  @Column({
    type: 'enum',
    enum: GenreSuggestionStatus,
    default: GenreSuggestionStatus.PENDING,
  })
  status: GenreSuggestionStatus;

  @Column({ name: 'reviewed_by', nullable: true })
  reviewedBy: string | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
