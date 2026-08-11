import {
    IsString,
    IsOptional,
    IsNumber,
    IsNotEmpty,
    IsDateString,
    ValidateNested,
    IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

export class OrderItemDto {
    @IsString()
    @IsNotEmpty()
    productCode: string;

    @IsNumber()
    quantity: number;
}

export class CreateOrderDto {

    @IsOptional()
    @IsNumber()
    orderNumber?: number;

    @IsString()
    @IsNotEmpty()
    customerName: string;

    @IsOptional()
    @IsString()
    marketerName: string;

    @IsString()
    @IsNotEmpty()
    customerPhone: string;

    @IsOptional()
    @IsString()
    customerPhone2?: string;

    @IsString()
    @IsNotEmpty()
    whatsappNumber: string;

    @IsString()
    @IsNotEmpty()
    governorate: string;

    @IsString()
    @IsNotEmpty()
    district: string;

    @IsOptional()
    @IsString()
    area?: string;

    @IsNumber()
    totalAmount: number;

    @IsOptional()
    @IsString()
    notes?: string;

    // @IsOptional()
    // createdAt?: Date | string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => OrderItemDto)
    items: OrderItemDto[];
}
