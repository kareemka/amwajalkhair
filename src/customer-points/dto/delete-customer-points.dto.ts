import { IsArray, ArrayNotEmpty, IsNumber } from 'class-validator';

export class DeleteCustomerPointsDto {
    @IsArray()
    @ArrayNotEmpty()
    @IsNumber({}, { each: true })
    ids: number[];
}
