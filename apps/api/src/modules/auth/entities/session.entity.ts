import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  DeleteDateColumn,
} from 'typeorm';
import { DeviceType } from '../../../common/enums';
import { User } from './user.entity';

@Entity('sessions')
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  // The jti (JWT ID) stored in the refresh token — used for rotation invalidation
  @Index({ unique: true })
  @Column({ name: 'refresh_token_id', length: 255 })
  refreshTokenId: string;

  @Column({ name: 'device_name', length: 200, nullable: true })
  deviceName: string | null;

  @Column({
    name: 'device_type',
    type: 'enum',
    enum: DeviceType,
    default: DeviceType.OTHER,
  })
  deviceType: DeviceType;

  @Column({ name: 'ip_address', length: 45, nullable: true })
  ipAddress: string | null;

  @Column({ name: 'last_seen_at', type: 'timestamptz', default: () => 'NOW()' })
  lastSeenAt: Date;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  // Soft-delete — revoked sessions are kept for audit, hard-deleted by cleanup worker
  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
