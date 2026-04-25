import { IsOptional, IsInt, Min, IsIn } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class GetRecommendationsDto {
  // size > 50 is silently clamped to 50
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Transform(({ value }) => Math.min(parseInt(String(value), 10) || 20, 50))
  size: number = 20;

  // 90d permanently removed (Q2 GAP decision)
  @IsOptional()
  @IsIn(['7d', '30d'])
  timeRange: '7d' | '30d' = '30d';
}
