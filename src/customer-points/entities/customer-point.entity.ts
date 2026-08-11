import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    CreateDateColumn,
} from 'typeorm';
import { Employee } from 'src/employee/entities/employee.entity';

export enum CustomerPointType {
    ADD = 'ADD',       // إضافة نقاط
    SUBTRACT = 'SUBTRACT', // خصم نقاط
}

@Entity()
export class CustomerPoint {
    @PrimaryGeneratedColumn()
    id: number;

    // نخزن النقاط دائمًا بالموجب
    @Column({ type: 'int' })
    points: number;

    // يبين نوع العملية (إضافة أو خصم)
    @Column({
        type: 'enum',
        enum: CustomerPointType,
    })
    type: CustomerPointType;

    // تاريخ إضافة السجل
    @CreateDateColumn()
    createdAt: Date;

    // الموظف اللي  مرتبط بالنقاط
    @ManyToOne(() => Employee, (emp) => emp.points, {
        onDelete: 'CASCADE',
        nullable: false,
    })
    employee: Employee;



}
