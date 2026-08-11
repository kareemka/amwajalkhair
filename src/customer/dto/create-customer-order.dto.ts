import {
    IsArray,
    IsNotEmpty,
    IsString,
    IsOptional,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OrderItemDto } from 'src/order/dto/create-order.dto';

// class OrderItemDto {
//     @IsString()
//     @IsNotEmpty()
//     productCode: string;

//     @IsInt()
//     @Min(1)
//     quantity: number;
// }

export class CreateCustomerOrderDto {

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

    @IsString()
    @IsNotEmpty()
    area: string;

    @IsOptional()
    @IsString()
    notes?: string;


    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => OrderItemDto)
    items: OrderItemDto[];
}
