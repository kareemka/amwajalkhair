import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    OneToMany,
} from 'typeorm';
import { CustomerNotificationRead } from './customer-notification-read.entity';

@Entity('customer_notifications')
export class CustomerNotification {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    title: string;

    @Column()
    body: string;

    @Column({ default: 'announcement' })
    type: 'offer' | 'announcement';

    @Column({ type: 'json', nullable: true })
    data?: Record<string, any>;

    @Column({ type: 'timestamp' })
    sentAt: Date;

    @CreateDateColumn()
    createdAt: Date;

    @OneToMany(
        () => CustomerNotificationRead,
        read => read.notification,
    )
    reads: CustomerNotificationRead[];
}
