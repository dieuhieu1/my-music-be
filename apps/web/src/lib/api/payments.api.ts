import apiClient from './axios';
import type { PremiumType } from '@mymusic/types';

export const paymentsApi = {
  // J1: Initiate VNPay — GET, returns { paymentUrl }
  initiateVnpay: (premiumType: PremiumType) =>
    apiClient.get('/payment/vnpay', { params: { premiumType } }),

  // J1: Initiate MoMo — POST, returns { payUrl }
  initiateMomo: (premiumType: PremiumType) =>
    apiClient.post('/payment/momo', { premiumType }),

  // J2: Verify VNPay callback — POST full query-param object from return URL
  verifyVnpay: (params: Record<string, string>) =>
    apiClient.post('/payment/vnpay/callback', params),

  // J3: Verify MoMo callback — POST full query-param object from return URL
  verifyMomo: (params: Record<string, string>) =>
    apiClient.post('/payment/momo/callback', params),

  // L6: Admin list all payment records
  getPaymentRecords: (params?: {
    page?: number;
    limit?: number;
    status?: string;
    provider?: string;
  }) => apiClient.get('/admin/payments', { params }),
};
