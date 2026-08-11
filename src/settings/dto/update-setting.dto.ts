import { IsInt, Min } from 'class-validator';

export class UpdateSettingDto {
    @IsInt()
    @Min(0)
    deliveryPrice: number;
}
