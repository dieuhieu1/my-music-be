import apiClient from './axios';
import type { PremiumType } from '@mymusic/types';

export const paymentsApi = {
  // J1: Initiate VNPay — GET, returns { paymentUrl }
  initiateVnpay: (premiumType: PremiumType) =>
    apiClient.get('/payment/vn-pay', { params: { premiumType } }),

  // J1: Initiate MoMo — POST, returns { paymentUrl }
  initiateMomo: (premiumType: PremiumType) =>
    apiClient.post('/payment/momo', { premiumType }),

  // L6: Admin list all payment records
  getPaymentRecords: (params?: {
    page?: number;
    limit?: number;
    status?: string;
    provider?: string;
  }) => apiClient.get('/admin/payments', { params }),
};
