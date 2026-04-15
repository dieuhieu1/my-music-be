import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Unique,
  Index,
} from 'typeorm';

export type FollowType = 'ARTIST' | 'USER';

// One row per (follower, followee) pair. The type column records what kind of
// entity is being followed so we know which counters to touch on follow/unfollow.
@Entity('follows')
@Unique(['followerId', 'followeeId'])
export class Follow {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'follower_id' })
  followerId: string;

  @Index()
  @Column({ name: 'followee_id' })
  followeeId: string;

  // ARTIST → also decrements/increments artist_profiles.follower_count
  // USER   → only touches users.follower_count / following_count
  @Column({ type: 'varchar', length: 10 })
  type: FollowType;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
