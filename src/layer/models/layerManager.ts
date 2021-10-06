import { Logger } from '@map-colonies/js-logger';
import { inject, injectable } from 'tsyringe';
import { Services } from '../../common/constants';
import { ILayerRepository, LAYER_REPOSITORY_SYMBOL } from '../DAL/ILayerRepository';
import { Layer } from './layer';

@injectable()
export class LayerManager {
  public constructor(
    @inject(LAYER_REPOSITORY_SYMBOL) private readonly layerRepository: ILayerRepository,
    @inject(Services.LOGGER) private readonly logger: Logger
  ) {}
  public async getAllLayers(): Promise<Layer[]> {
    return this.layerRepository.findAllLayers();
  }
}
