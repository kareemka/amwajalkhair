import {
  Controller,
  Get,
  Patch,
  Delete,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { AuthRolesGuard } from 'src/auth/guards/auth-roles.guard';
import { Roles } from 'src/auth/decorators/user-role.decorator';
import { UserType } from 'src/utils/enums';


@Controller('notifications')

export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
  ) { }

  // 📥 GET /notifications/my?page=1&limit=10
  @Get('my')
  @UseGuards(AuthRolesGuard)
  @Roles(
    UserType.ADMIN,
    UserType.MANAGER,
    UserType.LEADER,
    UserType.SUPERVISOR,
    UserType.REP,
    UserType.PROCESSOR,
  )
  getMyNotifications(
    @Req() req,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    const employeeId = req.user.sub;
    return this.notificationService.findEmployeeNotifications(
      employeeId,
      Number(page),
      Number(limit),
    );
  }

  // ✅ PATCH /notifications/mark-all-read
  @Patch('mark-all-read')
  @UseGuards(AuthRolesGuard)
  @Roles(
    UserType.ADMIN,
    UserType.MANAGER,
    UserType.LEADER,
    UserType.SUPERVISOR,
    UserType.REP,
    UserType.PROCESSOR,
  )
  markAllRead(@Req() req) {
    const employeeId = req.user.sub;
    return this.notificationService.markAllAsRead(employeeId);
  }

  // 🗑️ DELETE /notifications/clear-all
  @Delete('clear-all')
  @UseGuards(AuthRolesGuard)
  @Roles(UserType.ADMIN, UserType.MANAGER)
  clearAll() {
    return this.notificationService.clearAllNotifications();
  }
}
