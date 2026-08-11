import { IsOptional, IsNumber } from 'class-validator';

export class UpdateOrderItemDto {
    @IsOptional()
    @IsNumber()
    quantity?: number;
}
