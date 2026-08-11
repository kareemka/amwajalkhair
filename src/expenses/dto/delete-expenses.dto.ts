import { IsArray, ArrayNotEmpty, IsNumber } from 'class-validator';

export class DeleteExpensesDto {
    @IsArray()
    @ArrayNotEmpty()
    @IsNumber({}, { each: true })
    ids: number[];
}
