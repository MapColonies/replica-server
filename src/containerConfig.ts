import config from 'config';
import { getOtelMixin, Metrics } from '@map-colonies/telemetry';
import { DataSource } from 'typeorm';
import { trace, metrics as OtelMetrics } from '@opentelemetry/api';
import { DependencyContainer } from 'tsyringe/dist/typings/types';
import { instanceCachingFactory, instancePerContainerCachingFactory } from 'tsyringe';
import jsLogger, { LoggerOptions } from '@map-colonies/js-logger';
import { CleanupRegistry } from '@map-colonies/cleanup-registry';
import { HEALTHCHECK_SYMBOL, ON_SIGNAL, SERVICES, SERVICE_NAME } from './common/constants';
import { DATA_SOURCE_PROVIDER } from './common/db';
import { tracing } from './common/tracing';
import { replicaRouterFactory, REPLICA_ROUTER_SYMBOL } from './replica/routes/replicaRouter';
import { InjectionObject, registerDependencies } from './common/dependencyRegistration';
import { layerRouterFactory, LAYER_ROUTER_SYMBOL } from './layer/routes/layerRouter';
import { REPLICA_CUSTOM_REPOSITORY_SYMBOL, replicaRepositoryFactory } from './replica/DAL/typeorm/replicaRepository';
import { IObjectStorageConfig } from './common/interfaces';
import { dataSourceFactory, getDbHealthCheckFunction } from './common/db';
import { fileRepositoryFactory, FILE_CUSTOM_REPOSITORY_SYMBOL } from './replica/DAL/typeorm/fileRepository';
import { layerRepoFactory, LAYER_REPOSITORY_SYMBOL } from './layer/DAL/typeorm/layerRepository';

export interface RegisterOptions {
  override?: InjectionObject<unknown>[];
  useChild?: boolean;
}

export const registerExternalValues = async (options?: RegisterOptions): Promise<DependencyContainer> => {
  const cleanupRegistry = new CleanupRegistry();

  try {
    const loggerConfig = config.get<LoggerOptions>('telemetry.logger');
    const logger = jsLogger({ ...loggerConfig, mixin: getOtelMixin() });

    cleanupRegistry.on('itemFailed', (id, error, msg) => logger.error({ msg, itemId: id, err: error }));
    cleanupRegistry.on('finished', (status) => logger.info({ msg: `cleanup registry finished cleanup`, status }));

    const metrics = new Metrics();
    cleanupRegistry.register({ func: metrics.stop.bind(metrics), id: SERVICES.METER });
    metrics.start();

    const objectStorageConfig = config.get<IObjectStorageConfig>('objectStorage');

    tracing.start();
    const tracer = trace.getTracer(SERVICE_NAME);
    cleanupRegistry.register({ func: tracing.stop.bind(tracing), id: SERVICES.TRACER });

    const dependencies: InjectionObject<unknown>[] = [
      { token: SERVICES.CONFIG, provider: { useValue: config } },
      {
        token: DATA_SOURCE_PROVIDER,
        provider: { useFactory: instancePerContainerCachingFactory(dataSourceFactory) },
        postInjectionHook: async (deps: DependencyContainer): Promise<void> => {
          const dataSource = deps.resolve<DataSource>(DATA_SOURCE_PROVIDER);
          cleanupRegistry.register({ func: dataSource.destroy.bind(dataSource) });
          await dataSource.initialize();
        },
      },
      { token: SERVICES.LOGGER, provider: { useValue: logger } },
      { token: SERVICES.TRACER, provider: { useValue: tracer } },
      { token: SERVICES.METER, provider: { useValue: OtelMetrics.getMeterProvider().getMeter(SERVICE_NAME) } },
      { token: SERVICES.OBJECT_STORAGE, provider: { useValue: objectStorageConfig } },
      { token: REPLICA_CUSTOM_REPOSITORY_SYMBOL, provider: { useFactory: replicaRepositoryFactory } },
      { token: FILE_CUSTOM_REPOSITORY_SYMBOL, provider: { useFactory: fileRepositoryFactory } },
      { token: LAYER_REPOSITORY_SYMBOL, provider: { useFactory: layerRepoFactory } },
      { token: REPLICA_ROUTER_SYMBOL, provider: { useFactory: replicaRouterFactory } },
      { token: LAYER_ROUTER_SYMBOL, provider: { useFactory: layerRouterFactory } },
      {
        token: HEALTHCHECK_SYMBOL,
        provider: {
          useFactory: instanceCachingFactory((container) => {
            const dataSource = container.resolve<DataSource>(DATA_SOURCE_PROVIDER);
            return getDbHealthCheckFunction(dataSource);
          }),
        },
      },
      {
        token: ON_SIGNAL,
        provider: {
          useValue: cleanupRegistry.trigger.bind(cleanupRegistry),
        },
      },
    ];

    const container = await registerDependencies(dependencies, options?.override, options?.useChild);
    return container;
  } catch (error) {
    await cleanupRegistry.trigger();
    throw error;
  }
};
