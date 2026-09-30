import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * SHELL — the thing you'll be caching reads of. Nothing special.
 */
@Entity('lab_products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column('int', { default: 0 })
  price: number;

  @CreateDateColumn()
  createdAt: Date;
}
