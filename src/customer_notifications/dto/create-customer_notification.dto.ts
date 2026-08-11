import {
    IsString,
    IsNotEmpty,
    IsOptional,
    IsIn,
    IsObject,
    MaxLength,
} from 'class-validator';

export class CreateCustomerNotificationDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(150)
    title: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(1000)
    body: string;

    @IsOptional()
    @IsIn(['offer', 'announcement'])
    type?: 'offer' | 'announcement';

    @IsOptional()
    @IsObject()
    data?: Record<string, any>;
}
