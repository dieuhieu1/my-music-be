import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  Unique,
} from 'typeorm';

// Pre-serialized recommendation results per user+mood combination.
// Upserted on every scoring run; read-through on cache miss.
// UNIQUE(userId, mood) enforced at app layer for null-safety — see RecommendationsService.upsertCacheEntity().
@Entity('recommendation_cache')
@Unique(['userId', 'mood'])
export class RecommendationCache {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id' })
  userId: string;

  // null = general recommendations; non-null = mood-specific
  @Column({ length: 50, nullable: true, default: null })
  mood: string | null;

  // Pre-serialized SongRecommendationDto[] — stored as JSONB to avoid re-scoring on read
  @Column({ type: 'jsonb' })
  songs: object[];

  @Column({ name: 'computed_at', type: 'timestamptz' })
  computedAt: Date;

  // computedAt + 86400s
  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;
}
