import { Column, Entity, PrimaryColumn, CreateDateColumn, UpdateDateColumn, OneToMany, Index } from 'typeorm';
import { BUCKET_NAME_MAX_LENGTH_LIMIT } from '../../../common/constants';
import { GeometryType, ReplicaType } from '../../../common/enums';
import { Replica as IReplica } from '../../models/replica';
import { File } from './file';

@Entity()
export class Replica implements IReplica {
  @PrimaryColumn({ name: 'replica_id', type: 'uuid' })
  public replicaId!: string;

  @Index()
  @Column({ name: 'layer_id', type: 'integer' })
  public layerId!: number;

  @Column({ name: 'geometry_type', type: 'enum', enum: GeometryType })
  public geometryType!: GeometryType;

  @Column({ name: 'replica_type', type: 'enum', enum: ReplicaType })
  public replicaType!: ReplicaType;

  @Column({ name: 'is_hidden', type: 'boolean', default: true })
  public isHidden!: boolean;

  @Index()
  @Column({ name: 'bucket_name', type: 'character varying', length: BUCKET_NAME_MAX_LENGTH_LIMIT })
  public bucketName!: string;

  @Index()
  @Column({ type: 'timestamp with time zone' })
  public timestamp!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp without time zone' })
  public createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp without time zone' })
  public updatedAt!: Date;

  @OneToMany(() => File, (file) => file.replica)
  public files!: File[];
}
