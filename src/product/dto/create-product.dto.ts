// import {
//     IsString,
//     IsNumber,
//     Min,
//     Max,
//     IsInt,
//     Length,
//     IsOptional,
//     IsArray,
// } from 'class-validator';

// export class CreateProductDto {
//     @IsString({ message: 'كود المنتج يجب أن يكون نصاً' })
//     @Length(1, 20, {
//         message: 'كود المنتج يجب أن يكون بين 1 و 20 حرف',
//     })
//     code: string;

//     @IsString({ message: 'اسم المنتج يجب أن يكون نصاً' })
//     @Length(1, 255, {
//         message: 'اسم المنتج يجب أن يكون بين 1 و 255 حرف',
//     })
//     name: string;

//     @IsNumber({}, { message: 'السعر يجب أن يكون رقم' })
//     @Min(0, { message: 'السعر لا يمكن أن يكون أقل من صفر' })
//     price: number;

//     @IsInt({ message: 'الكمية يجب أن تكون رقم صحيح' })
//     @Min(0, { message: 'الكمية لا يمكن أن تكون أقل من صفر' })
//     quantity: number;

//     @IsNumber({}, { message: 'النقاط (CC) يجب أن تكون رقم' })
//     @Min(0, { message: 'النقاط (CC) لا يمكن أن تكون أقل من صفر' })
//     @Max(0.99, {
//         message: 'نقاط المنتج (CC) يجب أن تكون أقل من 1',
//     })
//     cc: number;


//     // ✅ صورة رئيسية
//     @IsOptional()
//     @IsString()
//     mainImage?: string;

//     // ✅ فيديو
//     @IsOptional()
//     @IsString()
//     videoUrl?: string;

//     // ✅ صور متعددة (روابط)
//     @IsOptional()
//     @IsArray()
//     @IsString({ each: true })
//     images?: string[];

// }



import { Type } from 'class-transformer';
import {
  IsString,
  IsNumber,
  Min,
  Max,
  IsInt,
  Length,
  IsOptional,
  IsArray,
} from 'class-validator';

export class CreateProductDto {
  @IsString()
  @Length(1, 20)
  code: string;

  @IsString()
  @Length(1, 255)
  name: string;

  @IsString()
  @IsOptional()
  discription?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  salePrice?: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  quantity: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(0.99)
  cc: number;

  @IsOptional()
  @IsString()
  mainImage?: string;

  @IsOptional()
  @IsString()
  videoUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];
}
