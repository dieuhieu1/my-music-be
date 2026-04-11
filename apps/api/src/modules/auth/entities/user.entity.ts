import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  OneToMany,
  Index,
} from 'typeorm';
import { Role } from '../../../common/enums';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Index({ unique: true })
  @Column({ length: 255 })
  email: string;

  @Column({ name: 'password_hash', length: 255 })
  passwordHash: string;

  @Column({ type: 'simple-array', default: Role.USER })
  roles: Role[];

  @Column({ name: 'is_email_verified', default: false })
  isEmailVerified: boolean;

  @Column({ name: 'failed_attempts', default: 0 })
  failedAttempts: number;

  @Column({ name: 'lock_until', type: 'timestamptz', nullable: true })
  lockUntil: Date | null;

  @Column({ name: 'avatar_url', length: 500, nullable: true })
  avatarUrl: string | null;

  @Column({ name: 'follower_count', default: 0 })
  followerCount: number;

  @Column({ name: 'following_count', default: 0 })
  followingCount: number;

  @Column({ name: 'premium_expires_at', type: 'timestamptz', nullable: true })
  premiumExpiresAt: Date | null;

  @Column({ name: 'download_quota', default: 0 })
  downloadQuota: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  // helpers
  get isPremium(): boolean {
    if (!this.roles.includes(Role.PREMIUM)) return false;
    if (this.premiumExpiresAt && this.premiumExpiresAt < new Date()) return false;
    return true;
  }

  get isLocked(): boolean {
    if (!this.lockUntil) return false;
    return this.lockUntil > new Date();
  }
}
