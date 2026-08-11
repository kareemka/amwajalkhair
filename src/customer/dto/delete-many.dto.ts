import { IsArray, IsString, ArrayNotEmpty } from 'class-validator';

export class DeleteManyCustomersDto {
    @IsArray()
    @ArrayNotEmpty()
    @IsString({ each: true })
    ids: string[];
}
