import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

// Shared pagination query params — used by any paginated list endpoint.
// Consumed via @Query() with the global ValidationPipe (transform: true).
export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
