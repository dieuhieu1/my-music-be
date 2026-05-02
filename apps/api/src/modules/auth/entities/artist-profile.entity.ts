import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';

@Entity('artist_profiles')
export class ArtistProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ name: 'user_id', nullable: true })
  userId: string | null;

  @OneToOne(() => User, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ name: 'is_official', default: false })
  isOfficial: boolean;

  @Column({ name: 'cover_image_url', length: 500, nullable: true })
  coverImageUrl: string | null;

  @Column({ name: 'stage_name', length: 100 })
  stageName: string;

  @Column({ type: 'text', nullable: true })
  bio: string | null;

  @Column({ name: 'avatar_url', length: 500, nullable: true })
  avatarUrl: string | null;

  @Column({ name: 'follower_count', default: 0 })
  followerCount: number;

  @Column({ name: 'listener_count', default: 0 })
  listenerCount: number;

  @Column({ type: 'simple-json', default: '[]' })
  socialLinks: { platform: string; url: string }[];

  @Column({ name: 'suggested_genres', type: 'simple-array', nullable: true })
  suggestedGenres: string[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
