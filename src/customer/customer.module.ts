import { Module } from '@nestjs/common';
import { CustomerService } from './customer.service';
import { CustomerController } from './customer.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Customer } from './entities/customer.entity';
import { AuthModule } from 'src/auth/auth.module';
import { OrderModule } from 'src/order/order.module';

@Module({
  imports: [TypeOrmModule.forFeature([Customer]), AuthModule, OrderModule],
  controllers: [CustomerController],
  providers: [CustomerService],
  exports: [CustomerService],
})
export class CustomerModule { }
