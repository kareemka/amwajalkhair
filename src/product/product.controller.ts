import { Controller, Get, Post, Body, Patch, Param, Delete, Query, Res, UploadedFiles, UploadedFile, UseInterceptors, DefaultValuePipe, ParseIntPipe } from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Response } from 'express';

import { FileFieldsInterceptor, FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';

@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) { }

  @Post()
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'mainImage', maxCount: 1 },
        { name: 'images', maxCount: 10 },
        { name: 'video', maxCount: 1 },
      ],
      {
        storage: diskStorage({
          destination: './uploads/products',
          filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
            cb(null, uniqueSuffix + extname(file.originalname));
          },
        }),
      },
    ),
  )
  create(
    @UploadedFiles()
    files: {
      mainImage?: Express.Multer.File[];
      images?: Express.Multer.File[];
      video?: Express.Multer.File[];
    },
    @Body() dto: CreateProductDto,
  ) {
    const main = files?.mainImage?.[0];
    const imgs = files?.images;
    const videoFile = files?.video?.[0];

    // Coerce numeric fields when request comes as multipart/form-data
    (dto as any).price = (dto as any).price !== undefined ? Number((dto as any).price) : undefined;
    (dto as any).quantity = (dto as any).quantity !== undefined ? Number((dto as any).quantity) : undefined;
    (dto as any).cc = (dto as any).cc !== undefined ? Number((dto as any).cc) : undefined;

    return this.productService.create(dto, main, imgs, videoFile);
  }


  // @Get('findAll')
  //    finadAll() {
  //     return this.productService.findAll();
  //   }


  @Get()
  findAllPaginate(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit: number,
  ) {
    return this.productService.findAllPaginate(page, limit);
  }



  // ───────────────────────────────────────
  // GET مجموع نقاط المنتجات
  // /products/total-points
  // ───────────────────────────────────────
  @Get('total-points')
  async getTotalPoints() {
    return this.productService.getTotalPoints();
  }

  @Get('export/excel')
  async exportProductsExcel(
    @Query('codes') codes: string,
    @Res() res: Response,
  ) {
    const arrCodes = codes
      ? codes.split(',').map(c => c.trim())
      : [];

    const buffer = await this.productService.exportProductsExcel(arrCodes);

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="products.xlsx"',
    });

    res.end(buffer);
  }


  @Get('search')
  search(@Query('name') name: string) {
    return this.productService.searchByName(name);
  }


  @Get(':code')
  findOne(@Param('code') code: string) {
    return this.productService.findOne(code);
  }

  @Patch(':code')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'mainImage', maxCount: 1 },
        { name: 'images', maxCount: 10 },
        { name: 'video', maxCount: 1 },
      ],
      {
        storage: diskStorage({
          destination: './uploads/products',
          filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
            cb(null, uniqueSuffix + extname(file.originalname));
          },
        }),
      },
    ),
  )
  update(
    @Param('code') code: string,
    @Body() dto: UpdateProductDto,
    @UploadedFiles()
    files: {
      mainImage?: Express.Multer.File[];
      images?: Express.Multer.File[];
      video?: Express.Multer.File[];
    },
  ) {
    const main = files?.mainImage?.[0];
    const imgs = files?.images;
    const videoFile = files?.video?.[0];

    return this.productService.updateWithFiles(code, dto, main, imgs, videoFile);
  }


  @Delete(':code')
  remove(@Param('code') code: string) {
    return this.productService.remove(code);
  }
}
