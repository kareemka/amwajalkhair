import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { Order } from 'src/order/entities/order.entity';
import { Employee } from 'src/employee/entities/employee.entity';
import { OrderStatus } from 'src/utils/order-status.enum';


@Entity()
export class OrderNotification {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Order, order => order.notifications, {
    onDelete: 'CASCADE',
  })
  order: Order;

  @ManyToOne(() => Employee, employee => employee.orderNotifications, {
    onDelete: 'CASCADE',
  })
  employee: Employee;

  @Column()
  title: string; // عنوان الإشعار، مثل "تحديث حالة الطلب"

  @Column('text')
  message: string; // نص الإشعار


  @Column({
    type: 'enum',
    enum: OrderStatus,
  })
  status: OrderStatus;

  @Column({ default: false })
  isRead: boolean;

  @CreateDateColumn()
  createdAt: Date;


}
