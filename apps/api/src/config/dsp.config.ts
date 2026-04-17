import { registerAs } from '@nestjs/config';

export const dspConfig = registerAs('dsp', () => ({
  url: process.env.DSP_URL || 'http://localhost:5000',
}));
