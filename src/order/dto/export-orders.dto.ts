import { IsArray, IsNumber } from 'class-validator';

export class ExportOrdersDto {
    @IsArray()
    @IsNumber({}, { each: true })
    ids: number[];
}