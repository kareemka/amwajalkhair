import { IsString, MinLength } from 'class-validator';

export class AdminUpdatePasswordDto {
    @IsString()
    @MinLength(4)
    newPassword: string;
}
