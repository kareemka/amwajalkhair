import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
    ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { CURRENT_USER_KEY } from 'src/utils/constants';
import { JWTPayload } from 'src/utils/types';
import { AuthService } from '../auth.service';

@Injectable()
export class AuthRolesGuard implements CanActivate {
    constructor(
        private jwtService: JwtService,
        private readonly config: ConfigService,
        private readonly reflector: Reflector,
        private readonly authService: AuthService
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const roles = this.reflector.getAllAndOverride('roles', [
            context.getHandler(),
            context.getClass(),
        ]);

        if (!roles || roles.length === 0) {
            return false;
        }

        const request = context.switchToHttp().getRequest<Request>();
        const token = this.extractTokenFromHeader(request);

        if (!token) {
            throw new UnauthorizedException('No token provided');
        }

        try {
            // تحقق من التوكن
            const payload: JWTPayload = await this.jwtService.verifyAsync(
                token,
                { secret: this.config.get<string>('JWT_ACCESS_SECRET') }
            );

            // جلب المستخدم من DB
            const user = await this.authService.findUserById(payload.sub);

            if (!user) {
                throw new UnauthorizedException('User not found');
            }

            // 🔴 تحقق الحظر
            if (user.isBlocked) {
                throw new ForbiddenException('Account is blocked');
            }

            // تحقق الصلاحيات
            if (!roles.includes(user.role)) {
                throw new UnauthorizedException('Insufficient permissions');
            }

            // إرفاق المستخدم بالطلب
            request[CURRENT_USER_KEY] = {
                ...payload,
                userType: user.userType,
                fullUser: user,
            };

            return true;
        } catch (error) {
            if (
                error instanceof UnauthorizedException ||
                error instanceof ForbiddenException
            ) {
                throw error;
            }

            throw new UnauthorizedException('Invalid token');
        }
    }

    private extractTokenFromHeader(request: Request): string | undefined {
        const [type, token] = request.headers.authorization?.split(' ') ?? [];
        return type === 'Bearer' ? token : undefined;
    }
}
