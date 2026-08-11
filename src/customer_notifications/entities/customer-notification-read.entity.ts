import { ManyToOne, JoinColumn, Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { CustomerNotification } from './customer_notification.entity';
import { Customer } from 'src/customer/entities/customer.entity';

@Entity('customer_notification_reads')
@Unique(['customer', 'notification'])
export class CustomerNotificationRead {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(
    () => Customer,
    customer => customer.notificationReads,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'customerId' })
  customer: Customer;

  @ManyToOne(
    () => CustomerNotification,
    notification => notification.reads,
    { onDelete: 'CASCADE' }, // (اختياري لكن ممتاز)
  )
  @JoinColumn({ name: 'notificationId' })
  notification: CustomerNotification;

  @Column({ default: false })
  isRead: boolean;


  @Column({ default: false })
  isDeleted: boolean;

  @Column({ type: 'timestamp', nullable: true })
  readAt?: Date;

  @CreateDateColumn()
  createdAt: Date;
}
