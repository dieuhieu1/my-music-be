import { PremiumType } from '@mymusic/types';

export interface Plan {
  type: PremiumType;
  duration: string;
  price: number;
  savingLabel?: string;
  popular?: boolean;
}

export const PLANS: Plan[] = [
  { type: PremiumType.ONE_MONTH,    duration: '1 month',   price: 30_000 },
  { type: PremiumType.THREE_MONTH,  duration: '3 months',  price: 79_000,  savingLabel: 'Save 12%', popular: true },
  { type: PremiumType.SIX_MONTH,   duration: '6 months',  price: 169_000, savingLabel: 'Save 6%' },
  { type: PremiumType.TWELVE_MONTH, duration: '12 months', price: 349_000, savingLabel: 'Save 3%' },
];
