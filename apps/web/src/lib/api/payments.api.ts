import apiClient from './axios';
import type { PremiumType } from '@mymusic/types';

export const paymentsApi = {
  // J2: Initiate VNPay payment — returns redirect URL
  initiateVnpay: (premiumType: PremiumType) =>
    apiClient.get('/payment/vn-pay', { params: { premiumType } }),

  // J3: Initiate MoMo payment — returns redirect URL
  initiateMomo: (premiumType: PremiumType) =>
    apiClient.get('/payment/momo', { params: { premiumType } }),

  // L6: Admin list all payment records
  getPaymentRecords: (params?: {
    page?: number;
    limit?: number;
    status?: string;
    provider?: string;
  }) => apiClient.get('/admin/payments', { params }),
};
