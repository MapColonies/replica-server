import { Column, Entity, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';

import { Replica } from './replica';

@Entity()
export class File {
  @PrimaryGeneratedColumn('uuid', { name: 'file_id' })
  public fileId!: string;

  @ManyToOne(() => Replica, (replica) => replica.files)
  @JoinColumn({ name: 'replica_id' })
  public replica!: Replica;

  @Column({ name: 'replica_id', type: 'uuid' })
  public replicaId!: string;

  @CreateDateColumn({ name: 'created_at' })
  public createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  public updatedAt!: Date;
}
