import { IsEnum, IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';
import { CustomerPointType } from '../entities/customer-point.entity';

export class CreateCustomerPointDto {

    @IsNumber({ maxDecimalPlaces: 3 })
    @Min(0.001)
    points: number;
    @IsEnum(CustomerPointType)
    type: CustomerPointType;

    @IsString()
    @IsNotEmpty()
    employeeId: string;
}
