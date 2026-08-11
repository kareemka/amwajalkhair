import { Controller, Get, Post, Body, Patch, Param, UseGuards, Query, Res, BadRequestException, Delete } from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { Roles } from 'src/auth/decorators/user-role.decorator';
import { UserType } from 'src/utils/enums';
import { AuthRolesGuard } from 'src/auth/guards/auth-roles.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { JWTPayload } from 'src/utils/types';
import { OrderStatus } from 'src/utils/order-status.enum';
import { ExportOrdersDto } from './dto/export-orders.dto';
import { BulkDeleteOrdersDto } from './dto/bulk-delete-orders.dto';



import { SkipThrottle, Throttle } from '@nestjs/throttler';

@SkipThrottle()
@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) { }

  // ========================= CREATE =========================
  @Post()
  @Roles(UserType.ADMIN, UserType.MANAGER, UserType.LEADER, UserType.SUPERVISOR, UserType.REP)
  @UseGuards(AuthRolesGuard)
  create(
    @CurrentUser() user: JWTPayload,
    @Body() createOrderDto: CreateOrderDto
  ) {
    const employeeId = user.sub;
    return this.orderService.create(createOrderDto, employeeId);
  }

  @SkipThrottle({ default: false })
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('public')
  createPublic(
    @Body() dto: CreateOrderDto
  ) {
    return this.orderService.createPublic(dto);
  }



  // ========================= SEARCH =========================
  @Get('search')
  @Roles(
    UserType.ADMIN,
  )
  @UseGuards(AuthRolesGuard)
  search(@Query('q') q: string) {
    if (!q) {
      throw new BadRequestException('الرجاء إدخال قيمة للبحث');
    }

    const cleaned = q.trim();

    if (!/^\d+$/.test(cleaned)) {
      throw new BadRequestException('الرجاء إدخال أرقام فقط');
    }

    return this.orderService.searchByOrderNumberOrPhone(cleaned);
  }


  // ========================= SEARCH  for processor =========================
  @Get('search-for-processor')
  @Roles(
    UserType.PROCESSOR,
  )
  @UseGuards(AuthRolesGuard)
  searchForProcessor(@Query('q') q: string) {
    if (!q) {
      throw new BadRequestException('الرجاء إدخال قيمة للبحث');
    }

    const cleaned = q.trim();

    if (!/^\d+$/.test(cleaned)) {
      throw new BadRequestException('الرجاء إدخال أرقام فقط');
    }

    return this.orderService.searchOrderByOrderNumberForProcessor(cleaned);
  }

  // @Get('search')
  // @Roles(
  //   UserType.ADMIN,
  //   UserType.MANAGER,
  //   UserType.LEADER,
  //   UserType.SUPERVISOR,
  //   UserType.REP,
  //   UserType.PROCESSOR,
  // )
  // @UseGuards(AuthRolesGuard)
  // searchOrder(@Query('orderNumber') orderNumber: string) {
  //   if (!orderNumber) throw new BadRequestException("الرجاء إدخال رقم الطلب");
  //   const cleaned = orderNumber.trim();
  //   if (!/^\d+$/.test(cleaned)) throw new BadRequestException("الرجاء إدخال رقم صحيح فقط");
  //   return this.orderService.searchOrderByNumber(cleaned);
  // }

  @Get('my-search')
  @Roles(UserType.MANAGER, UserType.LEADER, UserType.SUPERVISOR, UserType.REP)
  @UseGuards(AuthRolesGuard)
  mySearchOrder(
    @CurrentUser() user: JWTPayload,
    @Query('orderNumber') orderNumber: string
  ) {
    if (!orderNumber) throw new BadRequestException("الرجاء إدخال رقم الطلب");
    const cleaned = orderNumber.trim();
    if (!/^\d+$/.test(cleaned)) throw new BadRequestException("الرجاء إدخال رقم صحيح فقط");
    return this.orderService.searchOrderByNumberForEmployee(cleaned, user.sub);
  }

  // ========================= EXPORT =========================
  @Post('export')
  @Roles(UserType.ADMIN, UserType.MANAGER, UserType.LEADER, UserType.SUPERVISOR, UserType.REP)
  @UseGuards(AuthRolesGuard)
  async exportOrdersToExcel(@Body() dto: ExportOrdersDto, @Res() res: any) {
    const buffer = await this.orderService.exportOrdersToExcel(dto.ids);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=orders.xlsx');
    res.setHeader('Content-Length', buffer.length);
    return res.send(buffer);
  }

  @Post('bulk-receipts')
  @Roles(UserType.ADMIN, UserType.MANAGER, UserType.LEADER, UserType.SUPERVISOR, UserType.REP)
  @UseGuards(AuthRolesGuard)
  async getBulkReceipts(@Body('ids') ids: number[], @Res() res: any) {
    if (!ids || ids.length === 0) throw new BadRequestException("يرجى إرسال أرقام الطلبات");
    const pdfBuffer = await this.orderService.generateBulkReceiptsPdf(ids);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=receipts.pdf`);
    res.setHeader('Content-Length', pdfBuffer.length);
    return res.send(pdfBuffer);
  }

  // ========================= DASHBOARD =========================
  @Get('dashboard/global-stats')
  @Roles(UserType.ADMIN, UserType.PROCESSOR)
  @UseGuards(AuthRolesGuard)
  getGlobalStats() {
    return this.orderService.getGlobalDashboardStats();
  }

  @Get('dashboard/:employeeId')
  @Roles(UserType.ADMIN, UserType.MANAGER, UserType.LEADER, UserType.SUPERVISOR, UserType.REP)
  @UseGuards(AuthRolesGuard)
  getOrdersForDashboard(
    @Param('employeeId') employeeId: string,
    @Query('status') status?: OrderStatus | string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.orderService.getOrdersForDashboard(
      employeeId,
      status,
      parseInt(page) || 1,
      parseInt(limit) || 10,
    );
  }

  // ========================= MY ORDERS =========================
  @Get('my-orders')
  @Roles(UserType.ADMIN, UserType.MANAGER, UserType.LEADER, UserType.SUPERVISOR, UserType.REP)
  @UseGuards(AuthRolesGuard)
  getMyOrders(
    @CurrentUser() user: JWTPayload,
    @Query('status') status?: OrderStatus | string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const employeeId = user.sub;
    return this.orderService.getOrdersByEmployeeHierarchy(
      employeeId,
      status,
      parseInt(page) || 1,
      parseInt(limit) || 10,
    );
  }

  // ========================= ORDER RECEIPT / STATUS =========================
  @Get(':id/receipt')
  @Roles(UserType.ADMIN, UserType.MANAGER, UserType.LEADER, UserType.SUPERVISOR, UserType.REP, UserType.PROCESSOR)
  @UseGuards(AuthRolesGuard)
  async getOrderReceipt(@Param('id') id: string, @Res() res: any) {
    const pdfBuffer = await this.orderService.generateOrderReceiptPdf(+id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=receipt-${id}.pdf`);
    res.setHeader('Content-Length', pdfBuffer.length);
    return res.send(pdfBuffer);
  }


  // ========================= UPDATE MULTIPLE ORDER STATUS =========================
  @Patch('bulk-status')
  @Roles(UserType.ADMIN, UserType.PROCESSOR)
  @UseGuards(AuthRolesGuard)
  async updateMultipleOrderStatus(
    @Body('ids') ids: number[],
    @Body('status') status: OrderStatus,
    @Body('message') message?: string,
  ) {
    if (!ids || ids.length === 0) {
      throw new BadRequestException('يرجى إرسال قائمة الطلبات لتحديثها');
    }
    if (!status) {
      throw new BadRequestException('يرجى تحديد الحالة الجديدة للطلبات');
    }

    return this.orderService.updateMultipleOrderStatus(ids, status, message);
  }



  @Patch(':id/status')
  @Roles(UserType.ADMIN, UserType.PROCESSOR)
  @UseGuards(AuthRolesGuard)
  async updateOrderStatus(
    @Param('id') id: string,
    @Body('status') status: OrderStatus,
    @Body('message') message?: string,
  ) {
    return this.orderService.updateOrderStatus(+id, status, message);
  }

  // ========================= CRUD ORDERS =========================
  @Get(':id')
  @Roles(UserType.ADMIN, UserType.MANAGER, UserType.LEADER, UserType.SUPERVISOR, UserType.REP, UserType.PROCESSOR)
  @UseGuards(AuthRolesGuard)
  async getOrder(@Param('id') id: string) {
    return this.orderService.getOrderDetails(+id);
  }

  @Patch(':id')
  @Roles(UserType.ADMIN, UserType.MANAGER, UserType.LEADER, UserType.SUPERVISOR, UserType.REP)
  @UseGuards(AuthRolesGuard)
  async updateOrder(@Param('id') id: string, @Body() dto: UpdateOrderDto) {
    return this.orderService.updateOrder(+id, dto);
  }

  @Delete('bulk-delete')
  @Roles(UserType.ADMIN)
  @UseGuards(AuthRolesGuard)
  async bulkDelete(@Body() dto: BulkDeleteOrdersDto) {
    const result = await this.orderService.bulkDeleteOrdersWithStock(dto.ids);
    return {
      message: `تم حذف ${result.deletedCount} طلب${result.deletedCount > 1 ? 'ات' : ''} بنجاح`
    };
  }


  @Delete(':id')
  @Roles(UserType.ADMIN, UserType.MANAGER, UserType.LEADER, UserType.SUPERVISOR, UserType.REP)
  @UseGuards(AuthRolesGuard)
  async deleteOrder(@Param('id') id: string) {
    return this.orderService.deleteOrder(+id);
  }

  // ========================= ADMIN PAGINATION =========================
  @Get('admin/paginated')
  @Roles(UserType.ADMIN, UserType.PROCESSOR)
  @UseGuards(AuthRolesGuard)
  findPaginatedForAdmin(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: OrderStatus | string,
  ) {
    return this.orderService.findPaginatedForAdmin(
      Number(page) || 1,
      Number(limit) || 10,
      status,
    );
  }
}
