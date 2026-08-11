import { Controller, Post, Body, Get, Param, Delete, Query, Res } from '@nestjs/common';
import { CustomerPointsService } from './customer-points.service';
import { CreateCustomerPointDto } from './dto/create-customer-point.dto';
import { DeleteCustomerPointsDto } from './dto/delete-customer-points.dto';

@Controller('customer-points')
export class CustomerPointsController {
  constructor(private readonly service: CustomerPointsService) { }

  // إضافة نقاط للموظف
  @Post()
  addPoint(@Body() dto: CreateCustomerPointDto) {
    return this.service.addPoint(dto);
  }

  // جلب مجموع النقاط + السجلات لموظف معين
  @Get(':employeeId')
  getEmployeePointsPaginated(
    @Param('employeeId') employeeId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    return this.service.getEmployeePointsPaginated(
      employeeId,
      Number(page),
      Number(limit),
    );
  }



  @Get('export/excel')
  async exportPointsExcel(@Query('ids') ids: string, @Res() res) {
    const arrIds = ids.split(',').map(id => Number(id.trim()));
    const buffer = await this.service.exportExcel(arrIds);

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="customer_points.xlsx"`,
    });

    res.end(buffer);
  }



  // حذف نقطة واحدة
  @Delete(':id')
  deleteOne(@Param('id') id: number) {
    return this.service.deleteOne(id);
  }

  // حذف متعدد bulk
  @Post('bulk/delete')
  deleteBulk(@Body() dto: DeleteCustomerPointsDto) {
    return this.service.deleteBulk(dto.ids);
  }

}
