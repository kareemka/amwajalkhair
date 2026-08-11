import { IsString, IsNotEmpty, IsNumber } from 'class-validator';

export class CreateOrderItemDto {
    @IsString()
    @IsNotEmpty()
    productCode: string;

    @IsNumber()
    quantity: number;
}
