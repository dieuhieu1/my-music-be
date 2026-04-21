import { IsString, IsNotEmpty, IsNumber } from 'class-validator';

export class MomoCallbackDto {
  @IsString()
  @IsNotEmpty()
  partnerCode: string;

  @IsString()
  @IsNotEmpty()
  orderId: string;

  @IsString()
  @IsNotEmpty()
  requestId: string;

  @IsNumber()
  amount: number;

  @IsNumber()
  resultCode: number;

  @IsString()
  @IsNotEmpty()
  signature: string;

  @IsString()
  transId: string;
}
