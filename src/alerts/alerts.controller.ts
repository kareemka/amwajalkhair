import { Controller, Post, Body, Param, Delete, Query, Get, UseGuards } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { Roles } from 'src/auth/decorators/user-role.decorator';
import { AuthRolesGuard } from 'src/auth/guards/auth-roles.guard';
import { UserType } from 'src/utils/enums';
import { JWTPayload } from 'src/utils/types';

@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertService: AlertsService) { }

  @Post()
  async createAlert(
    @Body('title') title: string,
    @Body('details') details: string,
  ) {
    const alert = await this.alertService.createAlert(title, details);
    return {
      message: 'Alert created successfully',
      alert,
    };
  }

  // =========================
  // جلب التنبيهات مع Pagination
  // =========================
  @Get()
  async getAlerts(
    @Query('page') page: string,
    @Query('limit') limit: string,
  ) {
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    return this.alertService.getAlerts(pageNum, limitNum);
  }

  // =========================
  // جلب التنبيهات مع للموظف Pagination
  // =========================

  @Get('my-alerts')
   @Roles(
    UserType.ADMIN,
    UserType.MANAGER,
    UserType.LEADER,
    UserType.SUPERVISOR,
    UserType.REP,
    UserType.PROCESSOR,
  )
  @UseGuards(AuthRolesGuard)
  async getMyAlerts(
    @CurrentUser() user: JWTPayload,
    @Query('page') page: string,
    @Query('limit') limit: string,
  ) {
    const employeeId = user.sub; // <-- يتم جلب id من التوكن

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    

    return this.alertService.getEmployeeAlertsPaginated(
      employeeId,
      pageNum,
      limitNum,
    );
  }



  @Post('mark-all-read')
  @Roles(
    UserType.ADMIN,
    UserType.MANAGER,
    UserType.LEADER,
    UserType.SUPERVISOR,
    UserType.REP,
    UserType.PROCESSOR,
  )
  @UseGuards(AuthRolesGuard)
  async markAllRead(@CurrentUser() user: JWTPayload) {
    const employeeId = user.sub; // استخراج id الموظف من التوكن
    return this.alertService.markAllEmployeeAlertsRead(employeeId);
  }


  // =========================
  // حذف تنبيه واحد
  // =========================
  @Delete(':id')
  async deleteAlert(@Param('id') id: string) {
    return this.alertService.deleteAlert(Number(id));
  }

  // =========================
  // حذف متعدد
  // =========================
  @Post('delete-multiple')
  async deleteMultiple(@Body('ids') ids: number[]) {
    return this.alertService.deleteMultipleAlerts(ids);
  }
}
