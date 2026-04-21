import { IsString, IsNotEmpty } from 'class-validator';

// VNPay sends all params as query strings.
// We validate only the fields we act on; the rest are captured in @Query().
export class VnpayCallbackDto {
  @IsString()
  @IsNotEmpty()
  vnp_TxnRef: string;

  @IsString()
  @IsNotEmpty()
  vnp_ResponseCode: string;

  @IsString()
  @IsNotEmpty()
  vnp_SecureHash: string;

  @IsString()
  @IsNotEmpty()
  vnp_Amount: string;

  @IsString()
  @IsNotEmpty()
  vnp_TransactionNo: string;
}
