import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Res } from '@nestjs/common';
import type { Response } from 'express';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeeService } from './employee.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { Roles } from 'src/auth/decorators/user-role.decorator';
import { UserType } from 'src/utils/enums';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { JWTPayload } from 'src/utils/types';
import { AuthRolesGuard } from 'src/auth/guards/auth-roles.guard';




@Controller('employees')
export class EmployeeController {
  constructor(private service: EmployeeService) { }



  // =========================
  // 🔍 Get all employees for customers
  // =========================
  @Get('all-employees')
  allEmployees() {
    return this.service.allEmployees();
  }

  // =========================
  // 🔍 Get assigned employee for customer
  // =========================
  @Get('assigned-to-me')
  @Roles(UserType.CUSTOMER)
  @UseGuards(AuthRolesGuard)
  getAssignedEmployee(
    @CurrentUser() user: JWTPayload,
  ) {
    return this.service.findAssignedToCustomer(user.sub);
  }

  // =========================
  // 🔍 SEARCH
  // =========================
  @Get('search')
  @Roles(UserType.ADMIN)
  @UseGuards(AuthRolesGuard)
  searchMyEmployees(@Query('q') q: string) {
    return this.service.search(q);
  }

  // =========================
  // 👤 CURRENT USER RELATED
  // =========================
  @Get('my-added')
  @Roles(
    UserType.ADMIN,
    UserType.MANAGER,
    UserType.LEADER,
    UserType.SUPERVISOR,
    UserType.REP
  )
  @UseGuards(AuthRolesGuard)
  getMyAddedEmployees(
    @CurrentUser() user: JWTPayload,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
  ) {
    return this.service.getEmployeesAddedBy(
      user.sub,
      Number(page),
      Number(limit),
    );
  }

  @Post('my-children')
  @Roles(
    UserType.ADMIN,
    UserType.MANAGER,
    UserType.LEADER,
    UserType.SUPERVISOR,
    UserType.REP
  )
  @UseGuards(AuthRolesGuard)
  createChildEmployee(
    @Body() dto: CreateEmployeeDto,
    @CurrentUser() user: JWTPayload,
  ) {
    return this.service.createByEmployee(dto, user.sub);
  }

  @Patch('my-update/:id')
  @Roles(
    UserType.ADMIN,
    UserType.MANAGER,
    UserType.LEADER,
    UserType.SUPERVISOR,
    UserType.REP
  )
  @UseGuards(AuthRolesGuard)
  updateEmployeeInTree(
    @CurrentUser() user: JWTPayload,
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.service.updateEmployeeInTree(user.sub, id, dto);
  }



  // =========================
  // 🌳 HIERARCHY / TREE (Current Employee)
  // =========================
  @Get('hierarchy/me')
  @Roles(
    UserType.MANAGER,
    UserType.LEADER,
    UserType.SUPERVISOR,
    UserType.REP
  )
  @UseGuards(AuthRolesGuard)
  getMyHierarchy(
    @CurrentUser() user: JWTPayload,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    return this.service.findHierarchy(
      user.sub,
      Number(page),
      Number(limit),
    );
  }


  // =========================
  // 🌳 HIERARCHY / TREE
  // =========================
  @Get('hierarchy/:id')
  getHierarchy(
    @Param('id') id: string,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    return this.service.findHierarchy(id, Number(page), Number(limit));
  }

  @Delete('tree-delete/:id')
  @Roles(
    UserType.ADMIN,
    UserType.MANAGER,
    UserType.LEADER,
    UserType.SUPERVISOR,
    UserType.REP
  )
  @UseGuards(AuthRolesGuard)
  deleteEmployeeWithTree(
    @CurrentUser() user: JWTPayload,
    @Param('id') id: string,
  ) {
    return this.service.deleteEmployeeTree(user.sub, id);
  }

  // =========================
  // 🔔 TOKENS
  // =========================
  @Post('fcm-token')
  @Roles(
    UserType.ADMIN,
    UserType.MANAGER,
    UserType.LEADER,
    UserType.SUPERVISOR,
    UserType.REP
  )
  @UseGuards(AuthRolesGuard)
  saveFcmToken(
    @CurrentUser() user: JWTPayload,
    @Body('token') token: string,
  ) {
    return this.service.saveFcmToken(user.sub, token);
  }

  @Delete('fcm-token')
  @Roles(
    UserType.ADMIN,
    UserType.MANAGER,
    UserType.LEADER,
    UserType.SUPERVISOR,
    UserType.REP
  )
  @UseGuards(AuthRolesGuard)
  removeFcmToken(
    @CurrentUser() user: JWTPayload,
    @Body('token') token: string,
  ) {
    return this.service.removeFcmToken(user.sub, token);
  }

  @Get('referral/:code/whatsapp')
  async getWhatsAppByReferral(@Param('code') code: string) {
    const whatsapp = await this.service.getWhatsAppByReferralCode(code);
    return { whatsapp };
  }

  // =========================
  // 👨‍💼 ADMIN ACTIONS
  // =========================
  @Post()
  create(@Body() dto: CreateEmployeeDto) {
    return this.service.create(dto);
  }


  @Get('export/excel')
  @Roles(UserType.ADMIN)
  @UseGuards(AuthRolesGuard)
  async exportEmployeesExcel(
    @Query('ids') ids: string,
    @Res() res: Response,
  ) {
    const arrIds = ids
      ? ids.split(',').map(id => id.trim())
      : [];

    const buffer = await this.service.exportEmployeesExcel(arrIds);

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="employees.xlsx"',
    });

    res.end(buffer);
  }

  @Get('export/pdf/:id')
  @Roles(UserType.ADMIN)
  @UseGuards(AuthRolesGuard)
  async exportEmployeePdf(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const buffer = await this.service.generateEmployeeReportPdf(id);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="employee_${id}.pdf"`,
    });

    res.end(buffer);
  }

  @Get()
  findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    return this.service.findAll(Number(page), Number(limit));
  }

  @Patch(':id/block-tree')
  @Roles(UserType.ADMIN)
  @UseGuards(AuthRolesGuard)
  blockEmployeeTree(@Param('id') id: string) {
    return this.service.blockEmployeeTree(id);
  }

  @Patch(':id/unblock-tree')
  @Roles(UserType.ADMIN)
  @UseGuards(AuthRolesGuard)
  unblockEmployeeTree(@Param('id') id: string) {
    return this.service.unblockEmployeeTree(id);
  }

  // =========================
  // 🆔 SINGLE EMPLOYEE (LAST)
  // =========================
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateEmployeeDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.deleteEmployeeTreeByAdmin(id);
  }
}
