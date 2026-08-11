import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Setting {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'int', default: 10000 })
    deliveryPrice: number;
}
