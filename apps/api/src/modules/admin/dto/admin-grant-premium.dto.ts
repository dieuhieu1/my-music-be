import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class AdminGrantPremiumDto {
  @IsUUID()
  userId: string;

  @IsInt()
  @Min(1)
  @Max(3650)
  durationDays: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
