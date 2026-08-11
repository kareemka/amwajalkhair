import { Controller, Get, Param, Delete } from '@nestjs/common';
import { OrderItemService } from './order-item.service';

@Controller('order-items')
export class OrderItemController {
  constructor(private readonly service: OrderItemService) { }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(+id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(+id);
  }
}
