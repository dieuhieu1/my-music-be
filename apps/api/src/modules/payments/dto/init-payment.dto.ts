import { IsEnum } from 'class-validator';
import { PremiumType } from '../../../common/enums';

export class InitPaymentDto {
  @IsEnum(PremiumType)
  premiumType: PremiumType;
}
