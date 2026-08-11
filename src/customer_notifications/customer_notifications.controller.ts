import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { CustomerNotificationsService } from './customer_notifications.service';
import { CreateCustomerNotificationDto } from './dto/create-customer_notification.dto';
import { Roles } from 'src/auth/decorators/user-role.decorator';
import { AuthRolesGuard } from 'src/auth/guards/auth-roles.guard';
import { UserType } from 'src/utils/enums';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { JWTPayload } from 'src/utils/types';

@Controller('customer-notifications')
export class CustomerNotificationsController {
  constructor(
    private readonly customerNotificationsService: CustomerNotificationsService,
  ) { }

  // =========================
  // Admin Endpoints
  // =========================

  // إنشاء إشعار
  @Post()
  @Roles(UserType.ADMIN)
  @UseGuards(AuthRolesGuard)
  create(@Body() dto: CreateCustomerNotificationDto) {
    return this.customerNotificationsService.create(dto);
  }

  // جلب كل الإشعارات (Admin)
  @Get()
  @Roles(UserType.ADMIN)
  @UseGuards(AuthRolesGuard)
  getAllForAdmin(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    return this.customerNotificationsService.findAllForAdmin(
      Number(page),
      Number(limit),
    );
  }

  // حذف إشعار واحد (Admin)
  @Delete(':id')
  @Roles(UserType.ADMIN)
  @UseGuards(AuthRolesGuard)
  deleteOne(@Param('id', ParseIntPipe) id: number) {
    return this.customerNotificationsService.deleteNotification(id);
  }

  // حذف عدة إشعارات (Admin)
  @Post('delete-multiple')
  @Roles(UserType.ADMIN)
  @UseGuards(AuthRolesGuard)
  deleteMultiple(@Body('ids') ids: number[]) {
    return this.customerNotificationsService.deleteMultipleNotifications(ids);
  }

  // =========================
  // Customer Endpoints
  // =========================

  // جلب كل إشعاراتي
  @Get('me')
  @Roles(UserType.CUSTOMER)
  @UseGuards(AuthRolesGuard)
  getMyNotifications(
    @CurrentUser() user: JWTPayload,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    return this.customerNotificationsService.findForCustomer(
      user.sub,
      new Date(user.createdAt), // ⬅️ المفتاح
      Number(page),
      Number(limit),
    );

  }

  // جلب إشعار واحد لي
  @Get('me/:id')
  @Roles(UserType.CUSTOMER)
  @UseGuards(AuthRolesGuard)
  getMyNotification(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JWTPayload,
  ) {
    return this.customerNotificationsService.getNotification(user.sub, id);
  }

  // تعليم إشعار كمقروء
  @Post('me/:id/read')
  @Roles(UserType.CUSTOMER)
  @UseGuards(AuthRolesGuard)
  markAsRead(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JWTPayload,
  ) {
    return this.customerNotificationsService.markAsRead(user.sub, id);
  }

  // تعليم كل الإشعارات كمقروءة
  @Post('me/read-all')
  @Roles(UserType.CUSTOMER)
  @UseGuards(AuthRolesGuard)
  markAllAsRead(@CurrentUser() user: JWTPayload) {
    return this.customerNotificationsService.markAllAsRead(user.sub);
  }

  // حذف إشعار لي
  @Delete('me/:id')
  @Roles(UserType.CUSTOMER)
  @UseGuards(AuthRolesGuard)
  deleteMyNotification(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JWTPayload,
  ) {
    return this.customerNotificationsService.deleteNotificationForCustomer(
      user.sub,
      id,
    );
  }
}
