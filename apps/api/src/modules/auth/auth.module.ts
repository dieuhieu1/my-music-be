import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { BullModule } from '@nestjs/bullmq';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';

import { User } from './entities/user.entity';
import { ArtistProfile } from './entities/artist-profile.entity';
import { Session } from './entities/session.entity';
import { PasswordReset } from './entities/password-reset.entity';
import { VerificationCode } from './entities/verification-code.entity';

import { MailModule } from '../mail/mail.module';
import { QUEUE_NAMES } from '../queue/queue.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, ArtistProfile, Session, PasswordReset, VerificationCode]),
    PassportModule,
    // JwtModule used only to sign tokens — strategies validate using their own secrets
    JwtModule.register({}),
    BullModule.registerQueue({ name: QUEUE_NAMES.EMAIL }),
    MailModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtRefreshStrategy],
  exports: [AuthService, TypeOrmModule],
})
export class AuthModule {}
