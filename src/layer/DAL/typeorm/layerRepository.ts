import { DataSource } from 'typeorm';
import { FactoryFunction } from 'tsyringe';
import { Layer } from '../../models/layer';
import { DATA_SOURCE_PROVIDER } from '../../../common/db';
import { Layer as LayerEntity } from './layer';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const createFileRepo = (dataSource: DataSource) => {
  return dataSource.getRepository(LayerEntity).extend({
    async findAllLayers(): Promise<Layer[]> {
      return this.find({
        select: ['layerId', 'layerName', 'geometryTypes'],
        order: { layerId: 'ASC' },
      });
    },
  });
};

export type LayerRepository = ReturnType<typeof createFileRepo>;

export const layerRepoFactory: FactoryFunction<LayerRepository> = (depContainer) => {
  return createFileRepo(depContainer.resolve<DataSource>(DATA_SOURCE_PROVIDER));
};

export const LAYER_REPOSITORY_SYMBOL = Symbol('LayerRepository');
