import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    CreateDateColumn,
    UpdateDateColumn,
    OneToMany,
} from 'typeorm';
import { Employee } from 'src/employee/entities/employee.entity';
import { CustomerNotificationRead } from 'src/customer_notifications/entities/customer-notification-read.entity';

@Entity()
export class Customer {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    name: string;

    @Column({ unique: true })
    username: string;

    @Column()
    password: string;

    @Column({ nullable: true })
    phone?: string;



    // 🔗 الزبون تابع لموظف (إجباري)
    @Column()
    employeeId: string;

    @ManyToOne(() => Employee, (employee) => employee.customers, {
        onDelete: 'CASCADE',
        nullable: false,
    })
    employee: Employee;

    // // 📦 طلبات الزبون
    // @OneToMany(() => Order, (order) => order.customer)
    // orders: Order[];



    @Column({ default: false })
    isBlocked: boolean;



    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;


    @OneToMany(
        () => CustomerNotificationRead,
        read => read.customer,
    )
    notificationReads: CustomerNotificationRead[];

}
