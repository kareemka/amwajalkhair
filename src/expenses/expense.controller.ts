// expense.controller.ts
import { Controller, Post, Body, Get, Param, Delete, Query, Res, UseGuards } from '@nestjs/common';
import { ExpenseService } from './expense.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { DeleteExpensesDto } from './dto/delete-expenses.dto';
import { Roles } from 'src/auth/decorators/user-role.decorator';
import { UserType } from 'src/utils/enums';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { JWTPayload } from 'src/utils/types';
import { AuthRolesGuard } from 'src/auth/guards/auth-roles.guard';

@Controller('expenses')
export class ExpenseController {
  constructor(private readonly service: ExpenseService) { }

  @Post()
  addExpense(@Body() dto: CreateExpenseDto) {
    return this.service.addExpense(dto);
  }




  @Get('my-expenses')
  @Roles(
    UserType.ADMIN,
    UserType.MANAGER,
    UserType.LEADER,
    UserType.SUPERVISOR
  )
  @UseGuards(AuthRolesGuard)
  getMyExpensesPaginated(
    @CurrentUser() user: JWTPayload,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    const employeeId = user.sub;
    return this.service.getEmployeeHierarchyExpenses(
      employeeId,
      Number(page),
      Number(limit),
    );
  }

  @Get(':employeeId')
  getEmployeeExpensesPaginated(
    @Param('employeeId') employeeId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    return this.service.getEmployeeExpensesPaginated(
      employeeId,
      Number(page),
      Number(limit),
    );
  }



  @Get('receipt/:id')
  @Roles(
    UserType.ADMIN,
    UserType.MANAGER,
    UserType.LEADER,
    UserType.SUPERVISOR
  )
  @UseGuards(AuthRolesGuard)
  async getExpenseReceipt(
    @Param('id') id: number,
    @Res() res: any
  ) {
    const pdf = await this.service.generateExpenseReceiptPdf(id);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="expense-${id}.pdf"`,
      'Content-Length': pdf.length,
    });

    res.end(pdf);
  }


  @Get('export/excel')
  async exportExpensesExcel(@Query('ids') ids: string, @Res() res) {
    const arrIds = ids.split(',').map(id => Number(id.trim()));
    const buffer = await this.service.exportExcel(arrIds);

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="expenses.xlsx"`,
    });

    res.end(buffer);
  }

  @Delete(':id')
  deleteOne(@Param('id') id: number) {
    return this.service.deleteOne(id);
  }

  @Post('bulk/delete')
  deleteBulk(@Body() dto: DeleteExpensesDto) {
    return this.service.deleteBulk(dto.ids);
  }
}
