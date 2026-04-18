import { IsOptional, IsInt, Min, Max, IsString, MaxLength, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class BrowseSongsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  // Filter by genre UUID
  @IsOptional()
  @IsUUID()
  genre?: string;

  // Full-text search on title
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;
}
