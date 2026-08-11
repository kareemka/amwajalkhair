import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    OneToMany,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';
import { Order } from '../../order/entities/order.entity';
import { CustomerPoint } from 'src/customer-points/entities/customer-point.entity';
import { Expense } from 'src/expenses/entities/expense.entity';
import { EmployeeAlert } from 'src/alerts/entities/employee-alert.entity';
import { OrderNotification } from 'src/notification/entities/order-notification.entity';
import { Customer } from 'src/customer/entities/customer.entity';


export enum EmployeeRole {
    LEADER = 'LEADER',
    MANAGER = 'MANAGER',
    SUPERVISOR = 'SUPERVISOR',
    REP = 'REP',
    PROCESSOR = 'PROCESSOR',
}

@Entity()
export class Employee {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    name: string;

    @Column({ unique: true })
    username: string;

    @Column()
    password: string;

    @Column({ nullable: true })
    whatsapp?: string;

    @Column({
        type: 'enum',
        enum: EmployeeRole,
    })
    role: EmployeeRole;

    @Column({ nullable: true })
    parentId?: string;

    @Column({ unique: true, nullable: true })
    referralCode?: string;


    @ManyToOne(() => Employee, (emp) => emp.children, { onDelete: 'SET NULL' })
    parent?: Employee;

    @OneToMany(() => Employee, (emp) => emp.parent)
    children: Employee[];

    @Column({ default: false })
    isBlocked: boolean;

    @OneToMany(() => Order, (order) => order.employee)
    orders: Order[];

    @OneToMany(() => CustomerPoint, (point) => point.employee)
    points: CustomerPoint[];

    @OneToMany(() => Expense, (expense) => expense.employee)
    expenses: Expense[];

    @OneToMany(() => EmployeeAlert, (employeeAlert) => employeeAlert.employee)
    employeeAlerts: EmployeeAlert[];


    @OneToMany(
        () => OrderNotification,
        r => r.employee
    )
    orderNotifications: OrderNotification[];



    @OneToMany(() => Customer, (customer) => customer.employee)
    customers: Customer[];



    @Column({
        type: 'simple-array',
        nullable: true,
    })
    fcmTokens?: string[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

}
