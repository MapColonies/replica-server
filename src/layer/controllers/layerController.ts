import { Logger } from '@map-colonies/js-logger';
import { RequestHandler } from 'express';
import httpStatus from 'http-status-codes';
import { injectable, inject } from 'tsyringe';

import { SERVICES } from '../../common/constants';
import { Layer } from '../models/layer';
import { LayerManager } from '../models/layerManager';

type GetAllLayersHandler = RequestHandler<undefined, Layer[]>;

@injectable()
export class LayerController {
  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(LayerManager) private readonly manager: LayerManager
  ) {}

  public getLayers: GetAllLayersHandler = async (req, res, next) => {
    try {
      const layers = await this.manager.getAllLayers();
      return res.status(httpStatus.OK).json(layers);
    } catch (error) {
      return next(error);
    }
  };
}
