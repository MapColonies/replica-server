import { Layer } from '../models/layer';

export const LAYER_REPOSITORY_SYMBOL = Symbol('LayerRepository');

export interface ILayerRepository {
  findAllLayers: () => Promise<Layer[]>;
}
