import { IsOptional, IsEnum, IsInt, Min } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { MoodType } from '../../../common/enums';

export class GetMoodRecommendationsDto {
  @IsOptional()
  @IsEnum(MoodType)
  mood?: MoodType;

  // size > 50 is silently clamped to 50
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Transform(({ value }) => Math.min(parseInt(String(value), 10) || 20, 50))
  size: number = 20;
}
