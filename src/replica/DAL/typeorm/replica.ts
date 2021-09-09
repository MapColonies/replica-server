import { Column, Entity, PrimaryColumn, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';

import { BUCKET_NAME_MAX_LENGTH_LIMIT } from '../../../common/constants';
import { GeometryType, ReplicaType } from '../../../common/enums';
import { File } from './file';

@Entity()
export class Replica {
  @PrimaryColumn({ type: 'uuid' })
  public id!: string;

  @Column({ name: 'sync_id', type: 'uuid' })
  public syncId!: string;

  @Column({ name: 'layer_id', type: 'integer' })
  public layerId!: number;

  @Column({ name: 'geometry_type', type: 'enum', enum: GeometryType })
  public geometryType!: GeometryType;

  @Column({ name: 'replica_type', type: 'enum', enum: ReplicaType })
  public replicaType!: ReplicaType;

  @Column({ name: 'is_hidden', type: 'boolean', default: true })
  public isHidden!: boolean;

  @Column({ name: 'bucket_name', length: BUCKET_NAME_MAX_LENGTH_LIMIT })
  public bucketName!: string;

  @Column()
  public timestamp!: Date;

  @CreateDateColumn({ name: 'created_at' })
  public createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  public updatedAt!: Date;

  @OneToMany(() => File, (file) => file.replica)
  public files!: File[];
}
