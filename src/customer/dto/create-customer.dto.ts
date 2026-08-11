import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateCustomerDto {
    @IsString()
    @MinLength(2)
    name: string;

    @IsString()
    @MinLength(3)
    username: string;

    @IsOptional()
    @IsString()
    phone?: string;

    @IsString()
    @MinLength(4)
    password: string;

    // 👤 الموظف المسؤول (إجباري)
    @IsString()
    employeeId: string;

    @IsOptional()
    @IsBoolean()
    isBlocked?: boolean;
}
