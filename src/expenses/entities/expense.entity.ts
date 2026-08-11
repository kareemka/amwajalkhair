import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    CreateDateColumn,
} from 'typeorm';
import { Employee } from 'src/employee/entities/employee.entity';

// نوع العملية
export enum ExpenseType {
    DEPOSIT = 'DEPOSIT',   // إيداع
    WITHDRAW = 'WITHDRAW', // سحب
}

@Entity()
export class Expense {
    @PrimaryGeneratedColumn()
    id: number;

    // المبلغ
    @Column({ type: 'int' })
    amount: number;

    // نوع التحويل (نص)
    @Column({ type: 'varchar', length: 255 })
    transferType: string;

    // نوع المعاملة (إيداع / سحب)
    @Column({
        type: 'enum',
        enum: ExpenseType,
    })
    type: ExpenseType;

    // تاريخ التحويل
    @CreateDateColumn()
    createdAt: Date;

    // الموظف
    @ManyToOne(() => Employee, (emp) => emp.expenses, {
        onDelete: 'CASCADE',
        nullable: false,
    })
    employee: Employee;
}
