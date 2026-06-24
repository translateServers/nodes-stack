import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import type { JwtPayload } from '@/common/interfaces/jwt.interface';
import type { UserPayload } from '@/common/interfaces/user.interface';
import type { TypedConfigService } from '@/config/typed-config.service';
import type { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: TypedConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('jwt.secret'),
    });
  }

  async validate(payload: JwtPayload): Promise<UserPayload> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        roles: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!user) {
      return { id: payload.sub, roles: [] };
    }

    return {
      id: user.id,
      roles: user.roles.map((role: { id: string; name: string }) => ({
        id: role.id,
        name: role.name,
      })),
    };
  }
}
