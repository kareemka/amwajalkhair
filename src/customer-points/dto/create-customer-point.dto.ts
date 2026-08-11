import { IsEnum, IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';
import { CustomerPointType } from '../entities/customer-point.entity';

export class CreateCustomerPointDto {

    @IsNumber()
    @Min(1)
    points: number;

    @IsEnum(CustomerPointType)
    type: CustomerPointType;

    @IsString()
    @IsNotEmpty()
    employeeId: string;
}
