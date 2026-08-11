import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    OneToMany,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';
import { Employee } from '../../employee/entities/employee.entity';
import { OrderItem } from 'src/order-item/entities/order-item.entity';
import { OrderStatus } from 'src/utils/order-status.enum';
import { OrderChatMessage } from 'src/order_chat_message/entities/order_chat_message.entity';
import { OrderStatusLog } from 'src/order-status-log/entities/order-status-log.entity';
import { OrderNotification } from 'src/notification/entities/order-notification.entity';
import { OrderSource } from 'src/utils/enums';


@Entity()
export class Order {
    @PrimaryGeneratedColumn()
    id: number;


    // رقم الطلب القابل للتعديل، يمكن تركه فارغًا
    @Column({ unique: true, nullable: true })
    orderNumber?: number;


    @Column()
    customerName: string;

    @Column()
    customerPhone: string;

    @Column({ nullable: true })
    marketerName?: string;

    @Column({ nullable: true })
    customerPhone2?: string;

    @Column()
    whatsappNumber: string;

    @Column()
    governorate: string;

    @Column()
    district: string;

    @Column({ nullable: true })
    area?: string;

    @Column()
    totalAmount: number;

    @Column({ nullable: true })
    notes?: string;

    @ManyToOne(() => Employee, (employee) => employee.orders, {
        nullable: true,
        onDelete: 'SET NULL',
    })
    employee: Employee;

    @OneToMany(() => OrderItem, (item) => item.order, {
        cascade: true,
    })
    items: OrderItem[];



    @OneToMany(() => OrderStatusLog, log => log.order)
    statusLogs: OrderStatusLog[];


    @OneToMany(() => OrderChatMessage, msg => msg.order, { cascade: true })
    chatMessages: OrderChatMessage[];

    @OneToMany(
        () => OrderNotification,
        n => n.order,
    )
    notifications: OrderNotification[];



    // ⚡ الحالة الجديدة للطلب
    @Column({
        type: 'enum',
        enum: OrderStatus,
        default: OrderStatus.UNCONFIRMED,     // القيمة الافتراضية
    })
    status: OrderStatus;

    @Column({ type: 'timestamp', nullable: true })
    statusUpdatedAt: Date;


    @Column({
        type: 'enum',
        enum: OrderSource,
        default: OrderSource.EMPLOYEE_APP, // القيمة الافتراضية
    })
    source: OrderSource;


    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
