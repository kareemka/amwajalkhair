import { Module } from '@nestjs/common';
import { ProductService } from './product.service';
import { ProductController } from './product.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { OrderItem } from 'src/order-item/entities/order-item.entity';
import { ProductImage } from './entities/product-image.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Product, OrderItem, ProductImage])],
  controllers: [ProductController],
  providers: [ProductService],
  exports: [ProductService],
})
export class ProductModule { }
