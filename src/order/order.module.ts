import { Module } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { EmployeeModule } from 'src/employee/employee.module';
import { OrderItemModule } from 'src/order-item/order-item.module';
import { Product } from 'src/product/entities/product.entity';
import { AuthModule } from 'src/auth/auth.module';
import { OrderStatusLog } from 'src/order-status-log/entities/order-status-log.entity';
import { OrderChatMessage } from 'src/order_chat_message/entities/order_chat_message.entity';
import { NotificationModule } from 'src/notification/notification.module';
import { OrderNotification } from 'src/notification/entities/order-notification.entity';
import { OrderItem } from 'src/order-item/entities/order-item.entity';
import { Setting } from 'src/settings/entities/setting.entity';
import { Customer } from 'src/customer/entities/customer.entity';
import { JenniModule } from 'src/jenni/jenni.module';
import { forwardRef } from '@nestjs/common';

@Module({
  imports: [TypeOrmModule.forFeature([Order, Product, OrderStatusLog, OrderChatMessage, OrderNotification, OrderItem, Setting,

    Customer,

  ]), EmployeeModule, OrderItemModule, AuthModule,
    NotificationModule,
    forwardRef(() => JenniModule),
  ],
  controllers: [OrderController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule { }
