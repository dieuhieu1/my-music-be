import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsArray,
  IsUUID,
  IsNumber,
  Min,
  Max,
  IsDateString,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

// Valid Camelot Wheel codes for key validation
const CAMELOT_CODES = [
  '1A','2A','3A','4A','5A','6A','7A','8A','9A','10A','11A','12A',
  '1B','2B','3B','4B','5B','6B','7B','8B','9B','10B','11B','12B',
];

export class UploadSongDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  // Multipart forms send numbers as strings — transform to Number
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(20)
  @Max(400)
  bpm?: number;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.toString().toUpperCase())
  camelotKey?: string;

  // Repeated field: genreIds=id1&genreIds=id2  OR  a single value string
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : value ? [value] : []))
  @IsArray()
  @IsUUID('4', { each: true })
  genreIds?: string[];

  // Optional album to add the song to on upload
  @IsOptional()
  @IsUUID('4')
  albumId?: string;

  // ISO 8601 — drop date for scheduled release (Phase 8 / BL-59)
  @IsOptional()
  @IsDateString()
  dropAt?: string;

  // Free-text genre suggestion (creates a GenreSuggestion record)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  suggestGenre?: string;
}
