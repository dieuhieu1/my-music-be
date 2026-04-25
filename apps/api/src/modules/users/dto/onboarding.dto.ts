import { IsBoolean, IsOptional, IsUUID, ArrayMaxSize, ArrayMinSize, IsArray } from 'class-validator';

export class OnboardingDto {
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMinSize(0)
  @ArrayMaxSize(10)
  genreIds?: string[];

  @IsBoolean()
  skipped: boolean;
}
