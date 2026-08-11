import { Controller, Post, Body, UseGuards, Get, Patch, Req } from '@nestjs/common';
import { AdminService } from './admin.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { LoginAdminDto } from './dto/login-admin.dto';
import { AuthRolesGuard } from 'src/auth/guards/auth-roles.guard';
import { Roles } from 'src/auth/decorators/user-role.decorator';
import { UserType } from 'src/utils/enums';

@Controller('admin')
export class AdminController {
  constructor(private readonly service: AdminService) { }

  @Post('register')
  register(@Body() dto: CreateAdminDto) {
    return this.service.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginAdminDto) {
    return this.service.login(dto);
  }

  // -----------------------------------------------------------
  // جلب بيانات الادمن
  // -----------------------------------------------------------
  @Roles(UserType.ADMIN)
  @UseGuards(AuthRolesGuard)
  @Get('profile')
  getProfile(@Req() req: any) {
    const adminId = req.user.sub; // الـ payload من JWT
    return this.service.getProfile(adminId);
  }

  // -----------------------------------------------------------
  // تحديث كلمة المرور
  // -----------------------------------------------------------
  @Roles(UserType.ADMIN)
  @UseGuards(AuthRolesGuard)
  @Patch('password')
  updatePassword(@Req() req: any, @Body('newPassword') newPassword: string) {
    const adminId = req.user.sub;
    return this.service.updatePassword(adminId, newPassword);
  }
}
