// import { PartialType } from '@nestjs/mapped-types';
// import { CreateOrderDto } from './create-order.dto';


// export class UpdateOrderDto extends PartialType(CreateOrderDto) {}

import { IsEnum, IsOptional, IsString, IsArray, ValidateNested, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { OrderStatus } from 'src/utils/order-status.enum';

class UpdateOrderItemDto {
  @IsString()
  productCode: string;

  @IsNumber()
  @Min(1)
  quantity: number;
}

export class UpdateOrderDto {

  @IsOptional()
  @IsNumber()
  orderNumber?: number;

  // ---- Customer Info ----
  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsString()
  marketerName?: string;

  @IsOptional()
  @IsString()
  customerPhone?: string;

  @IsOptional()
  @IsString()
  customerPhone2?: string;

  @IsOptional()
  @IsString()
  whatsappNumber?: string;

  // ---- Address Info ----
  @IsOptional()
  @IsString()
  governorate?: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @IsString()
  area?: string;

  // ---- Order Notes ----
  @IsOptional()
  @IsString()
  notes?: string;

  // ---- Order Status ----
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @IsNumber()
  totalAmount?: number;

  // ---- Items ----
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateOrderItemDto)
  items: UpdateOrderItemDto[];
}
