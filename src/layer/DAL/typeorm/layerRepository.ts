import { EntityRepository, Repository } from 'typeorm';
import { Layer } from '../../models/layer';
import { ILayerRepository } from '../ILayerRepository';
import { Layer as LayerEntity } from './layer';

@EntityRepository(LayerEntity)
export class LayerRepository extends Repository<LayerEntity> implements ILayerRepository {
  public async findAllLayers(): Promise<Layer[]> {
    return this.find({
      select: ['layerId', 'layerName', 'geometryTypes'],
      order: { layerId: 'ASC' },
    });
  }
}
