import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn } from 'typeorm';
import { EmployeeAlert } from './employee-alert.entity';

@Entity()
export class Alert {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    title: string;

    @Column('text')
    details: string;

    @CreateDateColumn()
    createdAt: Date;

    @OneToMany(() => EmployeeAlert, (employeeAlert) => employeeAlert.alert)
    employeeAlerts: EmployeeAlert[];
}
