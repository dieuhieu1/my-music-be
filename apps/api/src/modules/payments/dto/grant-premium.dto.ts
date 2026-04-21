import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PremiumType } from '../../../common/enums';

export class GrantPremiumDto {
  @IsEnum(PremiumType)
  premiumType: PremiumType;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
