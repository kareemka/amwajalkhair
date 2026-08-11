import { Entity, Column, PrimaryColumn, OneToMany, CreateDateColumn } from 'typeorm';
import { ProductImage } from './product-image.entity';


@Entity()
export class Product {
    @PrimaryColumn({ type: 'varchar', length: 20 })
    code: string;

    @Column({ type: 'varchar', length: 255 })
    name: string;

    @Column({ type: 'int' })
    price: number;

    // 🏷️ السعر بعد الخصم (السعر الفعلي للبيع)
    @Column({ type: 'int', nullable: true })
    salePrice?: number;

    @Column({ type: 'int' })
    quantity: number;

    @Column({ type: 'float' })
    cc: number;

    @Column({ type: 'varchar', nullable: true })
    mainImage?: string;

    @Column({ type: 'varchar', nullable: true })
    videoUrl?: string;

    @OneToMany(() => ProductImage, (image) => image.product, { cascade: true })
    images?: ProductImage[];

    @Column({ type: 'text', nullable: true })
    discription?: string;

    // ✅ تاريخ الإنشاء تلقائي
    @CreateDateColumn({ type: 'timestamp' })
    createdAt: Date;
}
