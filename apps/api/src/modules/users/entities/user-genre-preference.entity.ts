import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  Unique,
} from 'typeorm';

// Populated by POST /users/me/onboarding (Phase 3 gap — not yet implemented).
// Read by RecommendationsService as the first cold-start fallback (BL-35A).
@Entity('user_genre_preferences')
@Unique(['userId', 'genreId'])
export class UserGenrePreference {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id' })
  userId: string;

  // FK to genres.id — not declared as ManyToOne to keep this entity lightweight
  @Column({ name: 'genre_id' })
  genreId: string;
}
