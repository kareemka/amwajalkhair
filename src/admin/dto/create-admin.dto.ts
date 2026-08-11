import { IsString, MinLength } from 'class-validator';

export class CreateAdminDto {
    @IsString()
    username: string;

    @IsString()
    fullName: string;

    @IsString()
    @MinLength(4)
    password: string;
}
