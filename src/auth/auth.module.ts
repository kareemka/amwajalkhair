import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthRolesGuard } from './guards/auth-roles.guard';
import { EmployeeModule } from 'src/employee/employee.module';
import { UserRepositorieModule } from 'src/user-repositorie/user-repositorie.module';
import { Admin } from 'src/admin/entities/admin.entity';
import { Customer } from 'src/customer/entities/customer.entity';



@Module({
    imports: [
        forwardRef(() => EmployeeModule),
        UserRepositorieModule,
        TypeOrmModule.forFeature([Admin, Customer]),
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.registerAsync({
            imports: [ConfigModule],
            useFactory: async (config: ConfigService) => ({
                secret: config.get<string>('JWT_SECRET'),
                signOptions: {
                    // expiresIn: '24h',
                    // expiresIn: '10s', // 10 ثوانٍ
                    expiresIn: '365d', // 365 يوم ≈ سنة واحدة
                },
            }),
            inject: [ConfigService],
        }),
    ],
    providers: [AuthService, AuthRolesGuard],
    controllers: [AuthController],
    exports: [AuthService, AuthRolesGuard, JwtModule],
})
export class AuthModule { }
