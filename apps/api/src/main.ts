import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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

  // Allow Next.js frontend (and any other origin defined in env)
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  });

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`🎵 API running → http://localhost:${port}/api/v1`);
  console.log(`❤  Health    → http://localhost:${port}/api/v1/health`);
}

bootstrap();
