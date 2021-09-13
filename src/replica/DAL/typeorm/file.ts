import { Column, Entity, CreateDateColumn, ManyToOne, JoinColumn, PrimaryGeneratedColumn } from 'typeorm';
import { Replica } from './replica';

@Entity()
export class File {
  @PrimaryGeneratedColumn('uuid', { name: 'file_id' })
  public fileId!: string;

  @ManyToOne(() => Replica, (replica) => replica.files, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'replica_id', referencedColumnName: 'replicaId' })
  public replica!: Replica;

  @Column({ name: 'replica_id', type: 'uuid' })
  public replicaId!: string;

  @CreateDateColumn({ name: 'created_at' })
  public createdAt!: Date;
}
