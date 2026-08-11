import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { Roles } from 'src/auth/decorators/user-role.decorator';
import { UserType } from 'src/utils/enums';
import { AuthRolesGuard } from 'src/auth/guards/auth-roles.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { JWTPayload } from 'src/utils/types';
import { ReportsPDFService } from './reportsPDF.service';


@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly reportsPDFService: ReportsPDFService,
  ) { }

  /* =====================================================
     DASHBOARD REPORTS (ADMIN) and EMPLOYEE PARENT
  ===================================================== */

  // 📊 Monthly Report (JSON)
  @Get('dashboard/monthly/:employeeId')
  @Roles(UserType.ADMIN, UserType.MANAGER, UserType.LEADER, UserType.SUPERVISOR, UserType.REP,)
  @UseGuards(AuthRolesGuard)
  getDashboardMonthlyReport(
    @Param('employeeId') employeeId: string,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    const now = new Date();
    const finalYear = year ? Number(year) : now.getFullYear();
    const finalMonth = month ? Number(month) : now.getMonth() + 1;

    return this.reportsService.getMonthlyReport(
      employeeId,
      finalYear,
      finalMonth,
    );
  }

  // 🧾 Monthly Report PDF
  @Get('dashboard/monthly/:employeeId/pdf')
  @Roles(UserType.ADMIN, UserType.MANAGER, UserType.LEADER, UserType.SUPERVISOR, UserType.REP,)
  @UseGuards(AuthRolesGuard)
  async getDashboardMonthlyReportPdf(
    @Param('employeeId') employeeId: string,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    const now = new Date();
    const finalYear = year ? Number(year) : now.getFullYear();
    const finalMonth = month ? Number(month) : now.getMonth() + 1;

    const buffer =
      await this.reportsPDFService.generateMonthlyReportPdf(
        employeeId,
        finalYear,
        finalMonth,
      );

    return {
      data: buffer.toString('base64'),
      filename: `report-${employeeId}-${finalMonth}-${finalYear}.pdf`,
    };
  }

  /* =====================================================
     EMPLOYEE REPORTS (SELF)
  ===================================================== */

  // 📊 Monthly Report (JSON)
  @Get('monthly')
  @Roles(
    UserType.ADMIN,
    UserType.MANAGER,
    UserType.LEADER,
    UserType.SUPERVISOR,
    UserType.REP,
  )
  @UseGuards(AuthRolesGuard)
  getMonthlyReport(
    @CurrentUser() user: JWTPayload,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    const now = new Date();
    const finalYear = year ? Number(year) : now.getFullYear();
    const finalMonth = month ? Number(month) : now.getMonth() + 1;

    return this.reportsService.getMonthlyReport(
      user.sub,
      finalYear,
      finalMonth,
    );
  }

  // 🧾 Monthly Report PDF
  @Get('monthly/pdf')
  @Roles(
    UserType.ADMIN,
    UserType.MANAGER,
    UserType.LEADER,
    UserType.SUPERVISOR,
    UserType.REP,
  )
  @UseGuards(AuthRolesGuard)
  async getMonthlyReportPdf(
    @CurrentUser() user: JWTPayload,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    const now = new Date();
    const finalYear = year ? Number(year) : now.getFullYear();
    const finalMonth = month ? Number(month) : now.getMonth() + 1;

    const buffer =
      await this.reportsPDFService.generateMonthlyReportPdf(
        user.sub,
        finalYear,
        finalMonth,
      );

    return {
      data: buffer.toString('base64'),
      filename: `report-${finalMonth}-${finalYear}.pdf`,
    };
  }


}
