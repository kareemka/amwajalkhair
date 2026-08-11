import { IsBoolean, IsEnum, IsNumberString, IsOptional, IsString, Length, Matches, MinLength } from 'class-validator';
import { EmployeeRole } from '../entities/employee.entity';

export class CreateEmployeeDto {

    @IsString()
    name: string;

    @IsString()
    username: string;

    @IsOptional()
    @Matches(/^\+[1-9]\d{9,14}$/, {
        message: 'رقم الواتساب يجب أن يكون بصيغة دولية مثل +9647XXXXXXXX',
    })
    whatsapp?: string;


    @IsString()
    @MinLength(4)
    password: string;

    @IsEnum(EmployeeRole)
    role: EmployeeRole;

    @IsOptional()
    @IsBoolean()
    isBlocked?: boolean;

    @IsOptional()
    @IsString()
    parentUsername?: string;

    @IsOptional()
    @IsString()
    referralCode?: string;

}
