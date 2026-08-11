import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    CreateDateColumn,
} from 'typeorm';
import { Order } from 'src/order/entities/order.entity';
import { Employee } from 'src/employee/entities/employee.entity';


@Entity()
export class OrderChatMessage {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Order, order => order.chatMessages, {
        onDelete: 'CASCADE',
    })
    order: Order;

    @ManyToOne(() => Employee, { onDelete: 'CASCADE', })
    sender: Employee;

    // المستقبل: موظف أيضًا
    @ManyToOne(() => Employee, { onDelete: 'CASCADE', })
    receiver: Employee;

    @Column()
    message: string;

    @CreateDateColumn()
    createdAt: Date;
}
