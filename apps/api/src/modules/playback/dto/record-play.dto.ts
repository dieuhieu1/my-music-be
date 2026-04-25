import { IsUUID, IsOptional, IsDateString, IsBoolean } from 'class-validator';

export class RecordPlayDto {
  @IsUUID()
  songId: string;

  // If omitted, the server uses the current timestamp.
  @IsOptional()
  @IsDateString()
  playedAt?: string;

  // true when the user skipped before the 30-second mark (Phase 10 BL-35B skip signal).
  // Defaults to false when omitted — backwards-compatible with Phase 5 callers.
  @IsOptional()
  @IsBoolean()
  skipped?: boolean;
}
