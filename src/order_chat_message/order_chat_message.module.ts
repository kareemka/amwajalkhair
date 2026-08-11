import { Module } from '@nestjs/common';
import { OrderChatMessageService } from './order_chat_message.service';
import { OrderChatMessageController } from './order_chat_message.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderChatMessage } from './entities/order_chat_message.entity';
import { Order } from 'src/order/entities/order.entity';
import { Employee } from 'src/employee/entities/employee.entity';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrderChatMessage,
      Order,
      Employee,
    ]),
    AuthModule,
  ],

  controllers: [OrderChatMessageController],
  providers: [OrderChatMessageService],
})
export class OrderChatMessageModule { }




