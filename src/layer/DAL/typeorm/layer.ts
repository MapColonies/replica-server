import { Column, Entity, CreateDateColumn, UpdateDateColumn, PrimaryColumn } from 'typeorm';
import { GeometryType } from '../../../common/enums';

@Entity()
export class Layer {
  @PrimaryColumn({ name: 'layer_id', type: 'integer' })
  public layerId!: number;

  @Column({ name: 'layer_name' })
  public layerName!: string;

  @Column({ name: 'geometry_types', type: 'enum', enum: GeometryType, array: true })
  public geometryTypes!: GeometryType[];

  @CreateDateColumn({ name: 'created_at' })
  public createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  public updatedAt!: Date;
}
