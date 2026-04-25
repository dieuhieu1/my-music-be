// Exact fields exposed in recommendation responses.
// energy is intentionally absent — internal DSP value only (BL-37A).
export class SongRecommendationDto {
  id: string;
  title: string;
  artistName: string;
  coverArtUrl: string | null;
  duration: number | null;
  genres: string[];
  bpm: number | null;
  camelotKey: string | null;
  totalPlays: number;
  createdAt: Date;
}
