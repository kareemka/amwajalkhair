import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Order } from '../../order/entities/order.entity';
import { Product } from '../../product/entities/product.entity';


@Entity()
export class OrderItem {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Order, order => order.items, {
        onDelete: 'CASCADE',
    })
    order: Order;

    @ManyToOne(() => Product, {
        nullable: true,
        onDelete: 'SET NULL',
    })
    product: Product | null;

    // بيانات ثابتة
    @Column({ nullable: true })
    productName: string;

    @Column({ nullable: true })
    productCode: string;

    // @Column({ type: 'int', nullable: true })
    // unitPrice: number;

    // النقاط cc أقل من 1
    @Column({ type: 'float', nullable: true })
    cc: number;

    @Column({ nullable: true })
    quantity: number;

    @Column({ type: 'float', nullable: true })
    price?: number;
}
