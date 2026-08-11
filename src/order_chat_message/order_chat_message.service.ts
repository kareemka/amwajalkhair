import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from 'src/order/entities/order.entity';
import { Employee } from 'src/employee/entities/employee.entity';
import { OrderChatMessage } from './entities/order_chat_message.entity';
import { EmployeeRole } from 'src/utils/enums';


@Injectable()
export class OrderChatMessageService {
  constructor(
    @InjectRepository(OrderChatMessage)
    private chatRepo: Repository<OrderChatMessage>,

    @InjectRepository(Order)
    private orderRepo: Repository<Order>,

    @InjectRepository(Employee)
    private employeeRepo: Repository<Employee>,
  ) { }

  // إرسال رسالة
  async sendMessageAuto(
    orderId: number,
    senderId: string,
    message: string,
  ) {
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: ['employee'], // صاحب الطلب (موظف)
    });
    if (!order) throw new BadRequestException('الطلب غير موجود');

    const sender = await this.employeeRepo.findOne({
      where: { id: senderId },
    });
    if (!sender) throw new BadRequestException('المرسل غير موجود');

    let receiver: Employee | null = null;

    // 🟢 إذا المرسل هو المعالج → الرسالة لصاحب الطلب
    if (sender.role === EmployeeRole.PROCESSOR) {
      receiver = order.employee;
    }

    // 🟡 إذا المرسل هو موظف
    if (sender.role !== EmployeeRole.PROCESSOR) {
      // 1️⃣ آخر رسالة في هذا الطلب
      const lastMessage = await this.chatRepo.findOne({
        where: {
          order: { id: orderId },
        },
        relations: ['sender', 'receiver'],
        order: { createdAt: 'DESC' },
      });

      if (lastMessage) {
        // 2️⃣ استخرج المعالج سواء كان مرسل أو مستقبل
        if (lastMessage.sender?.role === EmployeeRole.PROCESSOR) {
          receiver = lastMessage.sender;
        } else if (lastMessage.receiver?.role === EmployeeRole.PROCESSOR) {
          receiver = lastMessage.receiver;
        }
      }

      // 3️⃣ إذا لا يوجد معالج في المحادثة
      if (!receiver) {
        receiver = await this.employeeRepo.findOne({
          where: {
            role: EmployeeRole.PROCESSOR,
            isBlocked: false,
          },
          order: { createdAt: 'ASC' },
        });
      }
    }


    if (!receiver) {
      throw new BadRequestException('لا يوجد معالج متاح حاليًا');
    }

    const chatMessage = this.chatRepo.create({
      order,
      sender,
      receiver,
      message,
    });

    return this.chatRepo.save(chatMessage);
  }


  // جلب كل الرسائل للأدمن
  async getOrderMessages(orderId: number) {
    return this.chatRepo.find({
      where: { order: { id: orderId } },
      relations: ['sender', 'receiver'],
      order: { createdAt: 'ASC' },
    });
  }


}
