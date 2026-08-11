import { Entity, PrimaryGeneratedColumn, ManyToOne, Column, CreateDateColumn } from 'typeorm';
import { Alert } from './alert.entity';
import { Employee } from 'src/employee/entities/employee.entity';

@Entity()
export class EmployeeAlert {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Employee, (employee) => employee.employeeAlerts, { onDelete: 'CASCADE' })
    employee: Employee;

    @ManyToOne(() => Alert, (alert) => alert.employeeAlerts, { onDelete: 'CASCADE' })
    alert: Alert;

    @Column({ default: false })
    isRead: boolean;

    @CreateDateColumn()
    createdAt: Date;
}
