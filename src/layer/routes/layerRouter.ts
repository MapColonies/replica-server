import { Router } from 'express';
import { FactoryFunction } from 'tsyringe';
import { LayerController } from '../controllers/layerController';

const layerRouterFactory: FactoryFunction<Router> = (dependencyContainer) => {
  const router = Router();
  const controller = dependencyContainer.resolve(LayerController);

  router.get('/', controller.getLayers);

  return router;
};

export const LAYER_ROUTER_SYMBOL = Symbol('layerRouterFactory');

export { layerRouterFactory };
