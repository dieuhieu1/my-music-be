import { MoodType } from '../../common/enums';
import { RecommendationCache } from './entities/recommendation-cache.entity';

// Documents the DB operations performed by RecommendationsService on RecommendationCache.
// Use this interface when mocking the repository in unit tests.
export interface IRecommendationCacheOps {
  findByUserMood(userId: string, mood: MoodType | null): Promise<RecommendationCache | null>;
  upsertCacheEntity(
    userId: string,
    mood: MoodType | null,
    songs: object[],
    computedAt: Date,
    expiresAt: Date,
  ): Promise<void>;
  findExistingMoodsForUser(userId: string): Promise<string[]>;
}
