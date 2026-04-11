import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { Session } from '../entities/session.entity';

export interface RefreshPayload {
  sub: string;   // user ID
  jti: string;   // session / refresh token ID
}

function refreshCookieExtractor(req: Request): string | null {
  return req?.cookies?.refresh_token ?? null;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(
    config: ConfigService,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(Session)
    private readonly sessions: Repository<Session>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([refreshCookieExtractor]),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_REFRESH_SECRET') ?? 'change_me_refresh',
      passReqToCallback: false,
    });
  }

  async validate(payload: RefreshPayload): Promise<{ user: User; session: Session }> {
    const session = await this.sessions.findOne({
      where: { refreshTokenId: payload.jti },
      withDeleted: false,
    });
    if (!session) throw new UnauthorizedException('Session revoked or not found');

    const user = await this.users.findOne({ where: { id: payload.sub } });
    if (!user) throw new UnauthorizedException('User not found');

    return { user, session };
  }
}
