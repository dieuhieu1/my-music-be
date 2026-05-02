import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import * as cookieParser from 'cookie-parser';
import { WinstonModule } from 'nest-winston';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { winstonConfig } from './common/logger/winston.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger(winstonConfig),
  });

  // CORS must be first — before helmet, so preflight OPTIONS requests get the right headers
  const allowedOrigins = ['http://localhost:3000', 'http://localhost:3002'];

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Cookie',
      'x-device-type',
      'x-local-hour',
      'x-location-context',
      'Accept',
    ],
  });

  // Parse httpOnly cookies (access_token, refresh_token)
  app.use(cookieParser());

  // Security headers
  app.use(helmet());

  // All routes prefixed with /api/v1
  app.setGlobalPrefix('api/v1');

  // Validate + whitelist all incoming DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Wrap all success responses: { success: true, data: ... }
  app.useGlobalInterceptors(new TransformInterceptor());

  // Format all errors: { success: false, data: null, error: { code, message } }
  app.useGlobalFilters(new GlobalExceptionFilter());

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`🎵 API running → http://localhost:${port}/api/v1`);
  console.log(`❤  Health    → http://localhost:${port}/api/v1/health`);
}

bootstrap();
