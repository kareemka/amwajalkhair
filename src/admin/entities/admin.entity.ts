import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';

@Entity()
export class Admin {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    username: string;

    @Column()
    fullName: string;

    @Column()
    password: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
