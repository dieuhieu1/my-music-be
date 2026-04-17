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

// PATCH /songs/:id — artists can update title, BPM, Camelot Key, genre tags, and album.
// BPM and Camelot Key are artist-editable after DSP extraction (BL-37A).
// Energy is stored internally and is NOT exposed or editable via this DTO.
export class UpdateSongDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title?: string;

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

  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : value ? [value] : []))
  @IsArray()
  @IsUUID('4', { each: true })
  genreIds?: string[];

  // Set albumId to a UUID to add to an album; omit to leave unchanged
  @IsOptional()
  @IsUUID('4')
  albumId?: string;

  @IsOptional()
  @IsDateString()
  dropAt?: string;
}
