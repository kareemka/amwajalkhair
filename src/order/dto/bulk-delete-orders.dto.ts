import { IsArray, ArrayNotEmpty, IsInt } from 'class-validator';

export class BulkDeleteOrdersDto {
    @IsArray()
    @ArrayNotEmpty()
    @IsInt({ each: true })
    ids: number[];
}
