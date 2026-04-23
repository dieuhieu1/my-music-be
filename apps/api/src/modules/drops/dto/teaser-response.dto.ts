export class TeaserResponseDto {
  id: string;
  title: string;
  artistName: string;
  coverArtUrl: string | null;
  dropAt: Date;
  // "{stageName} · drops in {relative}" — derived, never stored in DB
  teaserText: string;
}
