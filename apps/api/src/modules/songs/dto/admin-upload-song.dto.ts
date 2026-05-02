import {
  IsString, MaxLength, IsOptional, IsArray, IsNumber, IsDateString, IsUUID, IsUrl,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AdminUploadSongDto {
  @IsString()
  @MaxLength(255)
  title: string;

  @IsOptional()
  @IsUUID()
  artistProfileId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  genreIds?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  bpm?: number;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  camelotKey?: string;

  @IsOptional()
  @IsDateString()
  dropAt?: string;

  @IsOptional()
  @IsUrl()
  coverArtUrl?: string;
}
