import { IsUUID, IsOptional, IsDateString } from 'class-validator';

export class RecordPlayDto {
  @IsUUID()
  songId: string;

  // If omitted, the server uses the current timestamp.
  @IsOptional()
  @IsDateString()
  playedAt?: string;
}
