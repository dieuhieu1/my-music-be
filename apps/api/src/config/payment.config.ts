import { registerAs } from '@nestjs/config';

export const paymentConfig = registerAs('payment', () => ({
  vnpay: {
    tmnCode: process.env.VNPAY_TMN_CODE ?? '',
    hashSecret: process.env.VNPAY_HASH_SECRET ?? '',
    url: process.env.VNPAY_URL ?? 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
    callbackUrl:
      process.env.VNPAY_CALLBACK_URL ??
      'http://localhost:3001/api/v1/payment/vn-pay/callback',
    returnUrl:
      process.env.VNPAY_RETURN_URL ?? 'http://localhost:3000/payment/vnpay',
  },
  momo: {
    partnerCode: process.env.MOMO_PARTNER_CODE ?? '',
    accessKey: process.env.MOMO_ACCESS_KEY ?? '',
    secretKey: process.env.MOMO_SECRET_KEY ?? '',
    apiUrl:
      process.env.MOMO_API_URL ??
      'https://test-payment.momo.vn/v2/gateway/api/create',
    returnUrl:
      process.env.MOMO_RETURN_URL ?? 'http://localhost:3000/payment/momo',
    notifyUrl:
      process.env.MOMO_NOTIFY_URL ??
      'http://localhost:3001/api/v1/payment/momo/callback',
  },
  downloadJwtSecret:
    process.env.DOWNLOAD_JWT_SECRET ?? 'change_me_download_jwt_secret_32ch',
}));
