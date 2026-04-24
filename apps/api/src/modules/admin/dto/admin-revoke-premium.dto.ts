import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class AdminRevokePremiumDto {
  @IsUUID()
  userId: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
