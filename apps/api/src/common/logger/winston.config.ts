import { utilities as nestWinstonUtils } from 'nest-winston';
import { format, transports } from 'winston';

const isProd = process.env.NODE_ENV === 'production';

const devFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.ms(),
  nestWinstonUtils.format.nestLike('MyMusic', {
    colors: true,
    prettyPrint: true,
  }),
);

const prodFormat = format.combine(
  format.timestamp(),
  format.errors({ stack: true }),
  format.json(),
);

export const winstonConfig = {
  level: isProd ? 'info' : 'debug',
  format: isProd ? prodFormat : devFormat,
  transports: [new transports.Console()],
};
