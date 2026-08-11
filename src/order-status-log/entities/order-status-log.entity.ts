import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { Order } from 'src/order/entities/order.entity';
import { OrderStatus } from 'src/utils/order-status.enum';

@Entity()
export class OrderStatusLog {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Order, order => order.statusLogs, {
        onDelete: 'CASCADE',
    })
    order: Order;

    @Column({ type: 'enum', enum: OrderStatus })
    status: OrderStatus;

    @Column('text')
    message: string;

    @CreateDateColumn()
    createdAt: Date;
}
