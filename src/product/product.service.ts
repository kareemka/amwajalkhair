import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, In, Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import * as ExcelJS from 'exceljs';
import { OrderItem } from 'src/order-item/entities/order-item.entity';
import * as fs from 'fs';
import * as path from 'path';


@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepo: Repository<OrderItem>,
  ) { }

  // ───────────────────────────────────────
  // تحويل أي رقم يأتي من الفرونت → P001
  // ───────────────────────────────────────
  private formatCode(num: number | string): string {
    const s = String(num).trim();

    // If already starts with P (e.g. P1 or P001), try to parse the digits
    if (/^P\d+$/i.test(s)) {
      const digits = s.slice(1);
      const n = Number(digits);
      if (isNaN(n)) throw new BadRequestException('Invalid product code');
      return `P${n.toString().padStart(3, '0')}`;
    }

    const n = Number(s);
    if (isNaN(n)) throw new BadRequestException('Invalid product code');
    return `P${n.toString().padStart(3, '0')}`;
  }


  // ───────────────────────────────────────
  // حذف آمن لملفات الوسائط 
  // ───────────────────────────────────────
  private deleteFileSafely(fileUrl?: string | null) {
    if (!fileUrl) return;
    try {
      // Avoid windows absolute path bugs by removing leading slashes
      const relativePath = fileUrl.replace(/^\/+/, '');
      const absolutePath = path.join(process.cwd(), relativePath);
      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
      }
    } catch (err) {
      console.error('Failed to delete file:', fileUrl, err);
    }
  }

  // ───────────────────────────────────────
  // CREATE
  // ───────────────────────────────────────
  // async create(
  //   dto: CreateProductDto,
  //   mainImage?: Express.Multer.File,
  //   images?: Express.Multer.File[],
  // ) {
  //   const formattedCode = this.formatCode(dto.code);

  //   const exists = await this.productRepo.findOne({
  //     where: { code: formattedCode },
  //   });

  //   if (exists) {
  //     throw new BadRequestException(`كود المنتج ${formattedCode} مستخدم مسبقاً`);
  //   }

  //   if (dto.cc >= 1) {
  //     throw new BadRequestException('نقاط المنتج (CC) يجب أن تكون أقل من 1');
  //   }

  //   const product = this.productRepo.create({
  //     code: formattedCode,
  //     name: dto.name,
  //     price: dto.price,
  //     quantity: dto.quantity,
  //     cc: dto.cc,
  //     mainImage: mainImage
  //       ? `/uploads/products/main/${mainImage.filename}`
  //       : null,
  //   });

  //   if (images?.length) {
  //     product.images = images.map((file) => ({
  //       imageUrl: `/uploads/products/images/${file.filename}`,
  //     })) as any;
  //   }

  //   return await this.productRepo.save(product);
  // }


  async create(
    dto: CreateProductDto,
    mainImage?: Express.Multer.File,
    images?: Express.Multer.File[],
    video?: Express.Multer.File,
  ) {
    const uploadedFiles: string[] = []; // لتتبع الملفات المرفوعة

    try {
      const codeVal = (dto as any).code;
      const formattedCode = this.formatCode(codeVal);

      (dto as any).price = (dto as any).price !== undefined ? Number((dto as any).price) : (dto as any).price;
      (dto as any).quantity = (dto as any).quantity !== undefined ? Number((dto as any).quantity) : (dto as any).quantity;
      (dto as any).cc = (dto as any).cc !== undefined ? Number((dto as any).cc) : (dto as any).cc;

      const exists = await this.productRepo.findOne({ where: { code: formattedCode } });
      if (exists) throw new BadRequestException(`كود المنتج ${formattedCode} مستخدم مسبقاً`);
      if (dto.cc >= 1) throw new BadRequestException('نقاط المنتج (CC) يجب أن تكون أقل من 1');

      // تتبع الملفات المرفوعة
      if (mainImage) uploadedFiles.push(mainImage.path);
      if (video) uploadedFiles.push(video.path);
      if (images?.length) images.forEach(img => uploadedFiles.push(img.path));

      const product = this.productRepo.create({
        code: formattedCode,
        name: dto.name,
        price: (dto as any).price,
        salePrice: (dto as any).salePrice,
        quantity: (dto as any).quantity,
        cc: (dto as any).cc,
        discription: dto.discription,
        mainImage: mainImage ? `/uploads/products/${mainImage.filename}` : null,
        videoUrl: video ? `/uploads/products/${video.filename}` : null,
        images: images?.map(file => ({ imageUrl: `/uploads/products/${file.filename}` })),
      });

      return await this.productRepo.save(product);
    } catch (err) {
      // ❌ حذف الملفات المرفوعة عند فشل الإضافة
      uploadedFiles.forEach(filePath => {
        fs.unlink(filePath, unlinkErr => {
          if (unlinkErr) console.error('Failed to delete file:', filePath, unlinkErr);
        });
      });

      throw err;
    }
  }





  async findAll() {
    return this.productRepo.find({
      order: { name: 'ASC' },
    });
  }

  // ───────────────────────────────────────
  // FIND ALL (Pagination)
  // ───────────────────────────────────────
  async findAllPaginate(page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [data, total] = await this.productRepo.findAndCount({
      skip,
      take: limit,
      // order: { createdAt: 'DESC' },
      order: { code: 'ASC' }, // ترتيب تصاعدي حسب كود المنتج
      relations: ['images'],
    });

    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      data,
    };
  }



  async searchByName(name: string): Promise<Product[]> {
    if (!name || !name.trim()) {
      throw new BadRequestException('اسم المنتج مطلوب');
    }

    return this.productRepo.find({
      where: {
        name: ILike(`%${name.trim()}%`),
      },
      order: { name: 'ASC' },
    });
  }



  async exportProductsExcel(codes: string[]) {
    const where = codes.length ? { code: In(codes) } : {};

    const products = await this.productRepo.find({
      where,
      order: { name: 'ASC' },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Havana System';

    const sheet = workbook.addWorksheet('المنتجات', {
      views: [{ rightToLeft: true }],
    });

    // صف فارغ
    sheet.addRow([]);

    // العنوان
    const titleRow = sheet.addRow(['قائمة المنتجات']);
    titleRow.font = { bold: true, size: 16 };
    sheet.mergeCells('A2:F2');
    titleRow.alignment = { horizontal: 'center' };

    sheet.addRow([]);

    // رؤوس الأعمدة
    sheet.addRow([
      'رقم',
      'كود المنتج',
      'اسم المنتج',
      'السعر',
      'الكمية',
      'النقاط (CC)',
    ]);

    const header = sheet.getRow(sheet.lastRow.number);
    header.font = { bold: true, size: 12 };
    header.alignment = { horizontal: 'center' };

    // البيانات
    products.forEach((product, index) => {
      sheet.addRow([
        index + 1,
        product.code,
        product.name,
        product.price,
        product.quantity,
        product.cc,
      ]);
    });

    // عرض الأعمدة
    sheet.columns = [
      { width: 8 },
      { width: 15 },
      { width: 30 },
      { width: 12 },
      { width: 12 },
      { width: 15 },
    ];

    return workbook.xlsx.writeBuffer();
  }



  // ───────────────────────────────────────
  // جلب مجموع نقاط كل المنتجات (النقاط * الكمية)
  // ───────────────────────────────────────
  async getTotalPoints(): Promise<{ totalCC: number }> {
    const result = await this.productRepo
      .createQueryBuilder('product')
      .select('SUM(CAST(product.cc AS double precision) * CAST(product.quantity AS double precision))', 'total') // ⬅️ ضرب النقاط في الكمية
      .getRawOne();

    return {
      totalCC: parseFloat(result.total) || 0, // parseFloat لتحويل النص الناتج إلى رقم عشري
    };
  }


  // ───────────────────────────────────────
  // FIND ONE
  // ───────────────────────────────────────
  async findOne(code: string): Promise<Product> {
    const formatted = this.formatCode(code);

    const product = await this.productRepo.findOne({
      where: { code: formatted },
      relations: ['images'],
    });

    if (!product) {
      throw new NotFoundException(
        `Product with code "${formatted}" not found`,
      );
    }

    return product;
  }

  // ───────────────────────────────────────
  // UPDATE
  // ───────────────────────────────────────
  async updateWithFiles(
    code: string,
    dto: UpdateProductDto,
    mainImage?: Express.Multer.File,
    images?: Express.Multer.File[],
    video?: Express.Multer.File,
  ): Promise<Product> {
    const formatted = this.formatCode(code);
    const existing = await this.productRepo.findOne({
      where: { code: formatted },
      relations: ['images'],
    });
    if (!existing) throw new NotFoundException('المنتج غير موجود');

    // تحويل القيم الرقمية
    if ((dto as any).price !== undefined) (dto as any).price = Number((dto as any).price);
    if ((dto as any).quantity !== undefined) (dto as any).quantity = Number((dto as any).quantity);
    if ((dto as any).cc !== undefined) (dto as any).cc = Number((dto as any).cc);

    // حذف الصور والفيديو القديم إذا تم رفع جديد
    if (mainImage) {
      if (existing.mainImage) {
        this.deleteFileSafely(existing.mainImage);
      }
      existing.mainImage = `/uploads/products/${mainImage.filename}`;
    }

    if (video) {
      if (existing.videoUrl) {
        this.deleteFileSafely(existing.videoUrl);
      }
      existing.videoUrl = `/uploads/products/${video.filename}`;
    }

    if (images && images.length) {
      // حذف الصور القديمة من السيرفر
      if (existing.images?.length) {
        existing.images.forEach(img => this.deleteFileSafely(img.imageUrl));
      }
      existing.images = images.map(file => ({ imageUrl: `/uploads/products/${file.filename}` })) as any;
    }

    // تحديث البيانات الأخرى
    const updated = Object.assign(existing, dto);
    return await this.productRepo.save(updated);
  }


  // ───────────────────────────────────────
  // DELETE
  // ───────────────────────────────────────
  // Service
  async remove(code: string): Promise<void> {

    const formatted = this.formatCode(code);
    const existing = await this.productRepo.findOne({
      where: { code: formatted },
      relations: ['images'], // جلب الصور المرتبطة
    });

    if (!existing) throw new NotFoundException('المنتج غير موجود');

    // فحص إذا المنتج مرتبط بأي طلب
    const count = await this.orderItemRepo.count({
      where: { product: { code: existing.code } },
    });
    if (count > 0) throw new BadRequestException('لا يمكن حذف هذا المنتج لأنه مرتبط بطلبات حالية');

    // حذف الملفات من السيرفر بأمان
    this.deleteFileSafely(existing.mainImage);
    this.deleteFileSafely(existing.videoUrl);

    if (existing.images?.length) {
      existing.images.forEach(img => this.deleteFileSafely(img.imageUrl));
    }


    await this.productRepo.remove(existing);
  }


}
