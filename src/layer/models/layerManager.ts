import { Logger } from '@map-colonies/js-logger';
import { inject, injectable } from 'tsyringe';
import { Services } from '../../common/constants';
import { LayerRepository, LAYER_REPOSITORY_SYMBOL } from '../DAL/typeorm/layerRepository';
import { Layer } from './layer';

@injectable()
export class LayerManager {
  public constructor(
    @inject(LAYER_REPOSITORY_SYMBOL) private readonly layerRepository: LayerRepository,
    @inject(Services.LOGGER) private readonly logger: Logger
  ) {}
  public async getAllLayers(): Promise<Layer[]> {
    this.logger.info('getting all layers');

    const layers = await this.layerRepository.findAllLayers();

    this.logger.debug({ msg: 'fetched layers', count: layers.length });
    return layers;
  }
}
