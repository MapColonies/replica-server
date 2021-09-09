import { Router } from 'express';
import { FactoryFunction } from 'tsyringe';
import { ReplicaController } from '../controllers/replicaController';

const replicaRouterFactory: FactoryFunction<Router> = (dependencyContainer) => {
  const router = Router();
  const controller = dependencyContainer.resolve(ReplicaController);

  router.get('/latest', controller.getLatestReplica);
  router.get('/:replicaId', controller.getReplicaById);
  router.post('/', controller.postReplica);
  router.post('/:replicaId/file', controller.postFile);

  return router;
};

export const REPLICA_ROUTER_SYMBOL = Symbol('replicaRouterFactory');

export { replicaRouterFactory };
